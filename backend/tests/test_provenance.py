"""Provenance contract tests: canonical hashing, idempotent runs, the
completed-run insert-ordering guard, and "newest succeeded run per
(extractor, kind)" supersession. See docs/recordings-provenance.md.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.models import DEFAULT_USER_ID, ExtractionRun
from app.provenance import canonical_params_hash, fold_input_sha256s
from app.repositories import provenance as repo
from app.schemas.provenance import RunCreate


def _enqueue_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "subjectKind": "piece",
        "subjectId": "well-tempered-1",
        "extractor": "beat-tracker",
        "extractorVersion": "0.1.0",
        "executor": "worker",
        "params": {"foo": "bar"},
        "inputSha256s": ["aaa", "bbb"],
    }
    payload.update(overrides)
    return payload


def _completed_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "subjectKind": "recording",
        "subjectId": "recording:11111111-1111-1111-1111-111111111111",
        "extractor": "midi-matcher",
        "extractorVersion": "1.0.0",
        "executor": "client",
        "params": {"exerciseId": "ex-1"},
        "inputSha256s": ["sha-a"],
        "status": "succeeded",
        "properties": [{"kind": "attempt_verdicts", "payload": {"ok": True}}],
    }
    payload.update(overrides)
    return payload


# ─── canonical_params_hash ─────────────────────────────────────────────


def test_canonical_hash_ignores_key_order_but_not_value() -> None:
    a = fold_input_sha256s({"b": 1, "a": 2}, ["h2", "h1"])
    b = fold_input_sha256s({"a": 2, "b": 1}, ["h1", "h2"])
    assert canonical_params_hash(a) == canonical_params_hash(b)

    changed = fold_input_sha256s({"a": 2, "b": 2}, ["h1", "h2"])
    assert canonical_params_hash(a) != canonical_params_hash(changed)

    # A different set of inputs is a different hash even with identical params.
    different_inputs = fold_input_sha256s({"a": 2, "b": 1}, ["h1", "h3"])
    assert canonical_params_hash(a) != canonical_params_hash(different_inputs)


# ─── enqueue path ───────────────────────────────────────────────────────


def test_enqueue_is_idempotent_and_has_no_patch(client: TestClient) -> None:
    r1 = client.post("/v1/runs", json=_enqueue_payload())
    assert r1.status_code == 201
    body1 = r1.json()
    assert body1["status"] == "queued"
    assert body1["executor"] == "worker"

    r2 = client.post("/v1/runs", json=_enqueue_payload())
    assert r2.status_code == 200
    assert r2.json()["id"] == body1["id"]

    # Runs are never updated in place by the API — no PATCH is exposed.
    patch = client.patch(f"/v1/runs/{body1['id']}", json={"status": "succeeded"})
    assert patch.status_code == 405


def test_enqueue_different_params_hash_creates_separate_runs(client: TestClient) -> None:
    r1 = client.post("/v1/runs", json=_enqueue_payload(params={"foo": "bar"}))
    r2 = client.post("/v1/runs", json=_enqueue_payload(params={"foo": "baz"}))
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] != r2.json()["id"]


# ─── completed-run path ─────────────────────────────────────────────────


def test_completed_run_lands_properties_and_is_idempotent(client: TestClient) -> None:
    r1 = client.post("/v1/runs", json=_completed_payload())
    assert r1.status_code == 201
    body1 = r1.json()
    assert body1["status"] == "succeeded"
    run_id = body1["id"]

    props = client.get(
        "/v1/subjects/recording/11111111-1111-1111-1111-111111111111/properties"
    ).json()
    assert len(props) == 1
    assert props[0]["kind"] == "attempt_verdicts"
    assert props[0]["run"]["id"] == run_id

    # Second identical post is a 200 hit; the posted properties are discarded
    # rather than duplicated.
    r2 = client.post("/v1/runs", json=_completed_payload())
    assert r2.status_code == 200
    assert r2.json()["id"] == run_id

    props_again = client.get(
        "/v1/subjects/recording/11111111-1111-1111-1111-111111111111/properties"
    ).json()
    assert len(props_again) == 1


def test_worker_only_extractor_posted_as_client_is_422(client: TestClient) -> None:
    r = client.post("/v1/runs", json=_completed_payload(extractor="beat-tracker"))
    assert r.status_code == 422


def test_completed_run_requires_a_terminal_status(client: TestClient) -> None:
    r = client.post("/v1/runs", json=_completed_payload(status=None))
    assert r.status_code == 422


# ─── supersession: newest succeeded run per (extractor, kind) ───────────


def test_latest_properties_returns_only_the_newer_runs_property(client: TestClient) -> None:
    kind, bare_id = "recording", "22222222-2222-2222-2222-222222222222"
    subject_id = f"{kind}:{bare_id}"

    r1 = client.post(
        "/v1/runs",
        json=_completed_payload(
            subjectId=subject_id,
            inputSha256s=["sha-1"],
            properties=[{"kind": "attempt_verdicts", "payload": {"v": 1}}],
        ),
    )
    assert r1.status_code == 201
    run1_id = r1.json()["id"]

    r2 = client.post(
        "/v1/runs",
        json=_completed_payload(
            subjectId=subject_id,
            inputSha256s=["sha-2"],
            properties=[{"kind": "attempt_verdicts", "payload": {"v": 2}}],
        ),
    )
    assert r2.status_code == 201
    run2_id = r2.json()["id"]
    assert run2_id != run1_id

    props = client.get(f"/v1/subjects/{kind}/{bare_id}/properties").json()
    assert len(props) == 1
    assert props[0]["payload"] == {"v": 2}
    assert props[0]["run"]["id"] == run2_id

    # Both runs remain visible — supersession is a read, never a delete.
    runs = client.get(f"/v1/subjects/{kind}/{bare_id}/runs").json()
    assert runs["total"] == 2
    assert {r["id"] for r in runs["items"]} == {run1_id, run2_id}


def test_latest_properties_keeps_older_runs_kind_not_superseded_by_a_different_kind(
    client: TestClient,
) -> None:
    # Run A produces two kinds; run B (same extractor) later produces only
    # one of them. The other kind should still come from run A.
    kind, bare_id = "recording", "33333333-3333-3333-3333-333333333333"
    subject_id = f"{kind}:{bare_id}"

    run_a = client.post(
        "/v1/runs",
        json=_completed_payload(
            subjectId=subject_id,
            inputSha256s=["sha-a"],
            properties=[
                {"kind": "attempt_verdicts", "payload": {"v": "a"}},
                {"kind": "alignment_map", "payload": {"v": "a"}},
            ],
        ),
    ).json()

    client.post(
        "/v1/runs",
        json=_completed_payload(
            subjectId=subject_id,
            inputSha256s=["sha-b"],
            properties=[{"kind": "attempt_verdicts", "payload": {"v": "b"}}],
        ),
    )

    props = {p["kind"]: p for p in client.get(f"/v1/subjects/{kind}/{bare_id}/properties").json()}
    assert props["attempt_verdicts"]["payload"] == {"v": "b"}
    assert props["alignment_map"]["payload"] == {"v": "a"}
    assert props["alignment_map"]["run"]["id"] == run_a["id"]


# ─── the insert-ordering guard (see the load-bearing flush comment in ───
# ─── app/repositories/provenance.py) ─────────────────────────────────────


def test_run_id_only_populates_after_flush(client: TestClient) -> None:
    """Pins the premise the load-bearing flush in
    `repo.get_or_create_completed_run` depends on: `ExtractionRun.id` (a
    client-side `default=uuid.uuid4`) is `None` until the row is flushed,
    because this app's sessions run with `autoflush=False`. If a future
    change ever builds `ExtractedProperty(run_id=run.id, ...)` before that
    flush, `run_id` would be `None` — a `NOT NULL` failure even on SQLite.
    The subtler Postgres-only failure this same flush prevents (no
    `relationship()` means no guaranteed cross-table insert order) is
    exercised for real in `tests/test_integration_postgres.py`.
    """
    run = ExtractionRun(
        user_id=DEFAULT_USER_ID,
        subject_kind="piece",
        subject_id="ordering-guard-subject",
        input_sha256s=[],
        extractor="beat-tracker",
        extractor_version="0.1.0",
        executor="worker",
        params={},
        params_hash="deadbeef",
        status="queued",
    )
    with SessionLocal() as db:
        db.add(run)
        assert run.id is None
        db.flush()
        assert run.id is not None
        db.rollback()


def test_completed_run_repo_lands_run_and_properties_in_one_flush(client: TestClient) -> None:
    data = RunCreate.model_validate(
        {
            "subjectKind": "piece",
            "subjectId": "ordering-guard-subject-2",
            "extractor": "scorer",
            "extractorVersion": "1.0.0",
            "executor": "client",
            "params": {},
            "inputSha256s": ["h1"],
            "status": "succeeded",
            "properties": [{"kind": "tempo_curve", "payload": {"x": 1}}],
        }
    )
    with SessionLocal() as db:
        run, created = repo.get_or_create_completed_run(
            db, DEFAULT_USER_ID, data, "succeeded", data.properties, None
        )
        assert created
        assert run.id is not None
        db.commit()
