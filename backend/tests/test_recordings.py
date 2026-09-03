"""Recordings + recording tracks: create/list/get/patch/soft-delete, track
upload with the shared oversize-upload cap, streaming download, and the
subject-pairing/no-subject-filter rules RC1's acceptance criteria pin. See
docs/recordings-provenance.md and `app/routers/recordings.py` /
`app/routers/recording_tracks.py`.

Every test runs against `MemoryMediaStore` (no network, no Docker) via the
`media_store` fixture, exactly matching `tests/test_idea_assets.py`'s
pattern.
"""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.deps import get_media_store
from app.main import app
from app.storage import MemoryMediaStore, content_key


@pytest.fixture
def media_store() -> Iterator[MemoryMediaStore]:
    store = MemoryMediaStore()
    app.dependency_overrides[get_media_store] = lambda: store
    try:
        yield store
    finally:
        app.dependency_overrides.pop(get_media_store, None)


def _create_recording(client: TestClient, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {"capturedAt": "2026-09-02T12:00:00Z", **overrides}
    r = client.post("/v1/recordings", json=body)
    assert r.status_code == 201
    data: dict[str, Any] = r.json()
    return data


def _upload_track(
    client: TestClient, recording_id: str, *, payload: bytes, kind: str, **form: Any
) -> Any:
    data = {"kind": kind, **form}
    return client.post(
        f"/v1/recordings/{recording_id}/tracks",
        files={"file": ("take.bin", payload, "application/octet-stream")},
        data=data,
    )


# ─── Criterion 1: create + upload audio track, sha256, listing, streaming ──


def test_create_upload_audio_list_and_stream_round_trip(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    recording = _create_recording(
        client, subjectKind="piece", subjectId="bach-invention-1", notes="warmup take"
    )
    assert recording["subjectKind"] == "piece"
    assert recording["subjectId"] == "bach-invention-1"
    assert recording["tracks"] == []

    payload = b"fake opus bytes standing in for a captured take"
    upload = _upload_track(client, recording["id"], payload=payload, kind="audio")
    assert upload.status_code == 201
    track = upload.json()
    assert track["kind"] == "audio"
    assert track["sha256"] == hashlib.sha256(payload).hexdigest()
    assert track["bytes"] == len(payload)
    assert track["offsetMs"] == 0
    assert media_store.put_count == 1

    # Listing by subject returns it, newest first.
    listing = client.get(
        "/v1/recordings", params={"subjectKind": "piece", "subjectId": "bach-invention-1"}
    )
    assert listing.status_code == 200
    items = listing.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == recording["id"]

    # The single-recording read embeds the uploaded track.
    got = client.get(f"/v1/recordings/{recording['id']}")
    assert got.status_code == 200
    assert [t["id"] for t in got.json()["tracks"]] == [track["id"]]

    # Content streams back byte-identical, with a matching ETag.
    dl = client.get(f"/v1/recordings/{recording['id']}/tracks/{track['id']}/content")
    assert dl.status_code == 200
    assert dl.content == payload
    assert dl.headers["etag"] == f'"{track["sha256"]}"'
    assert dl.headers["content-length"] == str(len(payload))


def test_listing_by_subject_is_newest_first(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    older = _create_recording(
        client, subjectKind="piece", subjectId="p1", capturedAt="2026-09-01T09:00:00Z"
    )
    newer = _create_recording(
        client, subjectKind="piece", subjectId="p1", capturedAt="2026-09-02T09:00:00Z"
    )
    items = client.get("/v1/recordings", params={"subjectKind": "piece", "subjectId": "p1"}).json()[
        "items"
    ]
    assert [i["id"] for i in items] == [newer["id"], older["id"]]


# ─── Criterion 2: MIDI-only + offset_ms round-trip; no-subject listing ─────


def test_midi_only_recording_with_offset_ms_round_trips(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    recording = _create_recording(client)  # no subject: a sight-reading attempt
    payload = b"MThd fake-but-plausible midi payload"
    upload = _upload_track(client, recording["id"], payload=payload, kind="midi", offsetMs=250)
    assert upload.status_code == 201
    track = upload.json()
    assert track["kind"] == "midi"
    assert track["offsetMs"] == 250

    got = client.get(f"/v1/recordings/{recording['id']}")
    assert got.status_code == 200
    body = got.json()
    assert len(body["tracks"]) == 1
    assert body["tracks"][0]["kind"] == "midi"
    assert body["tracks"][0]["offsetMs"] == 250
    # MIDI-only: no audio track required.
    assert all(t["kind"] == "midi" for t in body["tracks"])


def test_recording_with_no_subject_round_trips_and_lists_when_filter_absent(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    no_subject = _create_recording(client, notes="free practice noodling")
    assert no_subject["subjectKind"] is None
    assert no_subject["subjectId"] is None

    with_subject = _create_recording(client, subjectKind="piece", subjectId="p1")

    # No `?subjectKind=` at all: everything comes back, subject-less
    # recordings included — this is the exact case RC1's acceptance
    # criterion 2 pins.
    items = client.get("/v1/recordings").json()["items"]
    ids = {i["id"] for i in items}
    assert no_subject["id"] in ids
    assert with_subject["id"] in ids

    got = client.get(f"/v1/recordings/{no_subject['id']}")
    assert got.status_code == 200
    assert got.json()["subjectKind"] is None
    assert got.json()["subjectId"] is None


# ─── PATCH: notes + duration ────────────────────────────────────────────────


def test_patch_updates_notes_and_duration(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    recording = _create_recording(client)
    r = client.patch(
        f"/v1/recordings/{recording['id']}", json={"notes": "second take", "durationMs": 45_000}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["notes"] == "second take"
    assert body["durationMs"] == 45_000


# ─── DELETE: soft-delete only — the store still holds the key ─────────────


def test_delete_soft_deletes_but_store_still_holds_the_key(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    recording = _create_recording(client)
    payload = b"raw bytes are never deleted"
    upload = _upload_track(client, recording["id"], payload=payload, kind="audio")
    track = upload.json()

    assert client.delete(f"/v1/recordings/{recording['id']}").status_code == 204

    # Gone from the read paths...
    assert client.get(f"/v1/recordings/{recording['id']}").status_code == 404
    assert recording["id"] not in {i["id"] for i in client.get("/v1/recordings").json()["items"]}
    assert (
        client.get(f"/v1/recordings/{recording['id']}/tracks/{track['id']}/content").status_code
        == 404
    )

    # ...but the bytes are still in the store — "raw is immortal".
    stat = media_store.stat(track["storageKey"])
    assert stat is not None
    assert stat.size_bytes == len(payload)


def test_delete_missing_recording_is_404(client: TestClient, media_store: MemoryMediaStore) -> None:
    assert client.delete(f"/v1/recordings/{uuid.uuid4()}").status_code == 404


# ─── Uploads: invalid kind, missing recording, oversize ────────────────────


def test_upload_invalid_kind_is_422(client: TestClient, media_store: MemoryMediaStore) -> None:
    recording = _create_recording(client)
    r = _upload_track(client, recording["id"], payload=b"abc", kind="video")
    assert r.status_code == 422


def test_upload_to_missing_recording_is_404(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    r = _upload_track(client, str(uuid.uuid4()), payload=b"abc", kind="audio")
    assert r.status_code == 404


def test_oversize_upload_is_413_problem_json_and_leaves_no_object_in_store(
    client: TestClient, media_store: MemoryMediaStore, monkeypatch: Any
) -> None:
    recording = _create_recording(client)
    monkeypatch.setattr(settings, "media_max_upload_bytes", 10)
    payload = b"x" * 1000
    r = _upload_track(client, recording["id"], payload=payload, kind="audio")

    assert r.status_code == 413
    assert r.headers["content-type"] == "application/problem+json"

    sha256 = hashlib.sha256(payload).hexdigest()
    assert media_store.stat(content_key(sha256)) is None
    assert media_store.put_count == 0
    assert client.get(f"/v1/recordings/{recording['id']}").json()["tracks"] == []
