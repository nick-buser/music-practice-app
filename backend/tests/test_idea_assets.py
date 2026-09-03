"""Idea attachments: upload/revision semantics, streaming download, the
oversize-upload cap, and "raw is immortal" soft-delete. See
docs/sketchbook.md's "Attachments" section and `app/routers/idea_assets.py`.

Every test runs against `MemoryMediaStore` (no network, no Docker) via the
`media_store` fixture, which overrides `app.deps.get_media_store` for the
duration of the test — the same pattern `tests/test_storage.py` uses for
`/healthz`.
"""

from __future__ import annotations

import hashlib
import io
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.deps import get_media_store
from app.errors import ProblemException
from app.main import app
from app.models.provenance import ExtractionRun
from app.routers.idea_assets import _CappedStream  # pyright: ignore[reportPrivateUsage]
from app.storage import MemoryMediaStore, content_key


@pytest.fixture
def media_store() -> Iterator[MemoryMediaStore]:
    store = MemoryMediaStore()
    app.dependency_overrides[get_media_store] = lambda: store
    try:
        yield store
    finally:
        app.dependency_overrides.pop(get_media_store, None)


def _create_idea(client: TestClient) -> str:
    r = client.post("/v1/ideas", json={"body": "an idea to hang assets off of"})
    assert r.status_code == 201
    idea_id: str = r.json()["id"]
    return idea_id


def _upload(client: TestClient, idea_id: str, *, payload: bytes, role: str, **form: Any) -> Any:
    data = {"role": role, **form}
    return client.post(
        f"/v1/ideas/{idea_id}/assets",
        files={"file": ("asset.bin", payload, "application/octet-stream")},
        data=data,
    )


# ─── _CappedStream (the authoritative, streaming enforcement) ─────────────


def test_capped_stream_allows_exactly_the_cap() -> None:
    payload = b"a" * 100
    stream = _CappedStream(io.BytesIO(payload), max_bytes=100)
    assert stream.read(60) == payload[:60]
    assert stream.read() == payload[60:]  # totals exactly 100 — no raise


def test_capped_stream_raises_problem_413_past_the_cap() -> None:
    stream = _CappedStream(io.BytesIO(b"a" * 101), max_bytes=100)
    with pytest.raises(ProblemException) as exc_info:
        stream.read()
    assert exc_info.value.problem.status == 413


# ─── upload → revision 1, sha256 of the bytes sent ─────────────────────────


def test_upload_creates_revision_1_with_sha256_of_bytes_sent(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    idea_id = _create_idea(client)
    payload = b"a scrap of melody, encoded as fake midi bytes"
    r = _upload(client, idea_id, payload=payload, role="melody")
    assert r.status_code == 201
    body = r.json()
    assert body["revision"] == 1
    assert body["sha256"] == hashlib.sha256(payload).hexdigest()
    assert body["role"] == "melody"
    assert body["bytes"] == len(payload)
    assert body["runId"] is None
    assert media_store.put_count == 1


def test_plain_second_upload_stays_on_the_current_revision(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    idea_id = _create_idea(client)
    r1 = _upload(client, idea_id, payload=b"melody bytes", role="melody")
    r2 = _upload(client, idea_id, payload=b"harmony bytes", role="harmony")
    assert r1.json()["revision"] == 1
    assert r2.json()["revision"] == 1

    groups = client.get(f"/v1/ideas/{idea_id}/assets").json()
    assert len(groups) == 1
    assert groups[0]["revision"] == 1
    assert len(groups[0]["assets"]) == 2


def test_new_revision_true_bumps_revision_and_first_row_still_listed(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    idea_id = _create_idea(client)
    r1 = _upload(client, idea_id, payload=b"revision one bytes", role="melody")
    assert r1.json()["revision"] == 1

    r2 = _upload(client, idea_id, payload=b"revision two bytes", role="melody", newRevision="true")
    assert r2.json()["revision"] == 2

    groups = client.get(f"/v1/ideas/{idea_id}/assets").json()
    assert [g["revision"] for g in groups] == [2, 1]  # newest first
    assert groups[0]["assets"][0]["id"] == r2.json()["id"]
    assert groups[1]["assets"][0]["id"] == r1.json()["id"]


def test_identical_bytes_across_revisions_dedupe_in_the_store(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    idea_id = _create_idea(client)
    payload = b"identical bytes, uploaded twice"
    r1 = _upload(client, idea_id, payload=payload, role="reference")
    r2 = _upload(client, idea_id, payload=payload, role="reference", newRevision="true")
    assert r1.json()["storageKey"] == r2.json()["storageKey"]
    assert media_store.put_count == 1  # second put is a dedupe hit, not a new object


# ─── GET .../content: exact bytes, Content-Type, ETag ──────────────────────


def test_content_endpoint_streams_exact_bytes_with_content_type_and_etag(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    idea_id = _create_idea(client)
    payload = b"MThd fake-but-plausible midi payload"
    upload = _upload(client, idea_id, payload=payload, role="melody")
    asset = upload.json()

    dl = client.get(f"/v1/ideas/{idea_id}/assets/{asset['id']}/content")
    assert dl.status_code == 200
    assert dl.content == payload
    assert dl.headers["content-type"] == "application/octet-stream"
    assert dl.headers["etag"] == f'"{asset["sha256"]}"'
    assert dl.headers["content-length"] == str(len(payload))


# ─── oversize upload → 413 problem+json, no partial object in the store ───


def test_oversize_upload_is_413_problem_json_and_leaves_no_object_in_store(
    client: TestClient, media_store: MemoryMediaStore, monkeypatch: Any
) -> None:
    idea_id = _create_idea(client)
    monkeypatch.setattr(settings, "media_max_upload_bytes", 10)
    payload = b"x" * 1000
    r = _upload(client, idea_id, payload=payload, role="reference")

    assert r.status_code == 413
    assert r.headers["content-type"] == "application/problem+json"

    sha256 = hashlib.sha256(payload).hexdigest()
    assert media_store.stat(content_key(sha256)) is None
    assert media_store.put_count == 0
    assert client.get(f"/v1/ideas/{idea_id}/assets").json() == []


def test_invalid_role_is_422(client: TestClient, media_store: MemoryMediaStore) -> None:
    idea_id = _create_idea(client)
    r = _upload(client, idea_id, payload=b"abc", role="not-a-real-role")
    assert r.status_code == 422


def test_upload_to_missing_idea_is_404(client: TestClient, media_store: MemoryMediaStore) -> None:
    r = _upload(client, str(uuid.uuid4()), payload=b"abc", role="reference")
    assert r.status_code == 404


# ─── DELETE: soft-delete only — the store still holds the key ─────────────


def test_delete_soft_deletes_but_store_still_holds_the_key(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    idea_id = _create_idea(client)
    payload = b"raw bytes are never deleted"
    upload = _upload(client, idea_id, payload=payload, role="melody")
    asset = upload.json()

    assert client.delete(f"/v1/ideas/{idea_id}/assets/{asset['id']}").status_code == 204

    # Gone from the read paths...
    assert client.get(f"/v1/ideas/{idea_id}/assets/{asset['id']}/content").status_code == 404
    assert client.get(f"/v1/ideas/{idea_id}/assets").json() == []

    # ...but the bytes are still in the store — "raw is immortal"
    # (docs/sketchbook.md). This is the property that pins the whole
    # soft-delete-only design: nothing in the delete path ever calls
    # `store.delete()`.
    stat = media_store.stat(asset["storageKey"])
    assert stat is not None
    assert stat.size_bytes == len(payload)


def test_delete_missing_asset_is_404(client: TestClient, media_store: MemoryMediaStore) -> None:
    idea_id = _create_idea(client)
    r = client.delete(f"/v1/ideas/{idea_id}/assets/{uuid.uuid4()}")
    assert r.status_code == 404


# ─── PV3: audio/midi upload auto-enqueues a midi-features run ─────────────


def _upload_midi(
    client: TestClient, idea_id: str, *, payload: bytes, filename: str = "sketch.mid"
) -> Any:
    # The enqueue path (`_auto_enqueue_midi_features`) never parses these
    # bytes itself — that's the worker's job, later, when it actually claims
    # the run — so arbitrary bytes are enough to exercise the enqueue-on-mime
    # gate; `tests/test_midi_features.py` is what proves the extractor's own
    # MIDI parsing against real fixture bytes.
    return client.post(
        f"/v1/ideas/{idea_id}/assets",
        files={"file": (filename, payload, "audio/midi")},
        data={"role": "melody"},
    )


def _queued_midi_features_runs(db: Any) -> list[ExtractionRun]:
    return list(db.scalars(select(ExtractionRun).where(ExtractionRun.extractor == "midi-features")))


def test_uploading_a_midi_asset_auto_enqueues_one_queued_midi_features_run(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    idea_id = _create_idea(client)
    payload = b"placeholder bytes standing in for a captured .mid file"
    r = _upload_midi(client, idea_id, payload=payload)
    assert r.status_code == 201
    asset = r.json()

    with SessionLocal() as db:
        runs = _queued_midi_features_runs(db)
        assert len(runs) == 1
        run = runs[0]
        assert run.status == "queued"
        assert run.subject_kind == "idea"
        assert run.subject_id == f"idea:{idea_id}"
        assert run.input_sha256s == [asset["sha256"]]
        assert run.extractor_version == "1.0.0"
        assert run.executor == "worker"


def test_uploading_identical_midi_bytes_again_does_not_create_a_second_run(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    idea_id = _create_idea(client)
    payload = b"identical midi bytes, uploaded twice"
    r1 = _upload_midi(client, idea_id, payload=payload)
    r2 = _upload_midi(client, idea_id, payload=payload, filename="sketch-take-2.mid")
    assert r1.status_code == 201
    assert r2.status_code == 201
    # Two distinct asset rows (upload isn't deduped)...
    assert r1.json()["id"] != r2.json()["id"]
    assert r1.json()["sha256"] == r2.json()["sha256"]

    # ...but one run — same subject, same extractor/version, same (single)
    # input hash, so `get_or_create_queued_run`'s identity index collapses
    # the second enqueue attempt into a no-op hit.
    with SessionLocal() as db:
        assert len(_queued_midi_features_runs(db)) == 1


def test_uploading_a_non_midi_asset_does_not_auto_enqueue_anything(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    idea_id = _create_idea(client)
    r = _upload(client, idea_id, payload=b"just some audio bytes", role="reference")
    assert r.status_code == 201

    with SessionLocal() as db:
        assert _queued_midi_features_runs(db) == []
