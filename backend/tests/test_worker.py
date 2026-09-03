"""Job worker tests (PV2). See `.tickets/_grooming-sketchbook-and-media.md`'s
PV2 entry for the three acceptance criteria this file proves: `run_once`
success/failure with the built-in `sha256-echo` extractor, no double-execution
of one queued run across two `run_once` calls, and the embedded thread's gate
on `settings.worker_embedded`.
"""

from __future__ import annotations

import threading
import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.jobs import worker
from app.jobs.registry import AssetOut, ExtractorContext, PropertyOut, register
from app.main import app
from app.models import DEFAULT_USER_ID
from app.models.provenance import ExtractedProperty, ExtractionRun
from app.repositories import idea_assets as idea_assets_repo
from app.repositories import ideas as ideas_repo
from app.repositories import provenance as repo
from app.schemas.idea import IdeaCreate
from app.schemas.provenance import RunCreate


def _enqueue(db: Session, **overrides: Any) -> ExtractionRun:
    payload: dict[str, Any] = {
        "subjectKind": "piece",
        "subjectId": "well-tempered-1",
        "extractor": "sha256-echo",
        "extractorVersion": "1.0.0",
        "executor": "worker",
        "params": {},
        "inputSha256s": ["bbb", "aaa"],
    }
    payload.update(overrides)
    data = RunCreate.model_validate(payload)
    run, _created = repo.get_or_create_queued_run(db, DEFAULT_USER_ID, data)
    db.commit()
    return run


def _properties_for(db: Session, run_id: uuid.UUID) -> list[ExtractedProperty]:
    return list(db.scalars(select(ExtractedProperty).where(ExtractedProperty.run_id == run_id)))


# ─── criterion 1: sha256-echo succeeds; a raising extractor fails clean ──


def test_run_once_takes_sha256_echo_to_succeeded_with_input_hashes_property(
    client: TestClient,
) -> None:
    with SessionLocal() as db:
        run_id = _enqueue(db).id

    with SessionLocal() as db:
        result = worker.run_once(db)
        assert result is not None
        assert result.id == run_id
        assert result.status == "succeeded"
        assert result.started_at is not None
        assert result.finished_at is not None
        assert result.error is None

        props = _properties_for(db, run_id)
        assert len(props) == 1
        assert props[0].kind == "sha256_echo"
        # Sorted regardless of enqueue order — matches `Sha256Echo.run`.
        assert props[0].payload == {"inputSha256s": ["aaa", "bbb"]}


class _RaisingExtractor:
    """Test-only extractor registered once at import time — proves the
    failure path independent of any real extractor's internals.
    """

    name = "test-raiser"
    version = "0.0.1"

    def run(self, ctx: ExtractorContext) -> list[PropertyOut | AssetOut]:
        raise RuntimeError("boom: extractor blew up")


register(_RaisingExtractor())


def test_run_once_marks_a_raising_extractor_failed_with_no_partial_properties(
    client: TestClient,
) -> None:
    with SessionLocal() as db:
        run_id = _enqueue(
            db, extractor="test-raiser", extractorVersion="0.0.1", subjectId="raiser-subject"
        ).id

    with SessionLocal() as db:
        result = worker.run_once(db)
        assert result is not None
        assert result.id == run_id
        assert result.status == "failed"
        assert result.error is not None
        assert "boom: extractor blew up" in result.error
        assert result.finished_at is not None

        # No partial properties survive a failed run.
        assert _properties_for(db, run_id) == []


def test_run_once_reports_unknown_extractor_as_a_failed_run(client: TestClient) -> None:
    with SessionLocal() as db:
        run_id = _enqueue(
            db,
            extractor="nonexistent-extractor",
            extractorVersion="0.0.0",
            subjectId="unknown-extractor-subject",
        ).id

    with SessionLocal() as db:
        result = worker.run_once(db)
        assert result is not None
        assert result.status == "failed"
        assert result.error is not None
        assert "nonexistent-extractor" in result.error
        assert _properties_for(db, run_id) == []


# ─── criterion 2: two run_once calls never double-execute one run ───────


def test_run_once_never_double_executes_a_single_queued_run(client: TestClient) -> None:
    with SessionLocal() as db:
        run_id = _enqueue(db).id

    with SessionLocal() as db:
        first = worker.run_once(db)
    assert first is not None
    assert first.id == run_id
    assert first.status == "succeeded"

    # A second call finds nothing left in `queued` — the same run is never
    # picked up (and therefore never re-executed) a second time.
    with SessionLocal() as db:
        second = worker.run_once(db)
    assert second is None

    with SessionLocal() as db:
        assert len(_properties_for(db, run_id)) == 1


def test_run_once_sequential_double_claim_across_two_queued_runs(client: TestClient) -> None:
    """The logic actually reachable on SQLite: two calls, two distinct
    queued runs, never the same run claimed twice. See
    `worker._claim_oldest_queued`'s docstring for why this is a sequential
    proof, not a proof of the Postgres `FOR UPDATE SKIP LOCKED` path under
    real concurrency.
    """
    with SessionLocal() as db:
        run_a_id = _enqueue(db, subjectId="claim-subject-a").id
        run_b_id = _enqueue(db, subjectId="claim-subject-b").id
    expected = {run_a_id, run_b_id}

    claimed: set[uuid.UUID] = set()
    for _ in range(2):
        with SessionLocal() as db:
            result = worker.run_once(db)
            assert result is not None
            assert result.id not in claimed, "run_once claimed the same run twice"
            claimed.add(result.id)

    assert claimed == expected
    with SessionLocal() as db:
        assert worker.run_once(db) is None


# ─── criterion 3: the embedded thread respects worker_embedded ──────────


def test_embedded_worker_thread_does_not_start_when_worker_embedded_is_false() -> None:
    # Forced by tests/conftest.py for the whole suite; assert the premise
    # rather than silently relying on it.
    assert settings.worker_embedded is False

    # The shared `client` fixture never triggers FastAPI's lifespan at all
    # (it builds a bare `TestClient(app)` and seeds the DB by hand) — that
    # would make "no thread" trivially true regardless of whether the gate
    # in app/main.py's lifespan actually works. Driving lifespan for real
    # via `with TestClient(app) as ...:` is what makes this test prove
    # something.
    with TestClient(app) as scoped_client:
        response = scoped_client.get("/healthz")
        assert response.status_code == 200
        assert "job-worker" not in {t.name for t in threading.enumerate()}

    assert "job-worker" not in {t.name for t in threading.enumerate()}


# ─── AssetOut path (not required by PV2's acceptance criteria, but real, ──
# ─── shipped behavior worth pinning — see AssetOut's docstring) ─────────


class _AssetProducingExtractor:
    name = "test-asset-producer"
    version = "0.0.1"

    def run(self, ctx: ExtractorContext) -> list[PropertyOut | AssetOut]:
        return [
            AssetOut(role="render", filename="out.txt", mime="text/plain", data=b"hello worker")
        ]


register(_AssetProducingExtractor())


def test_run_once_writes_an_asset_out_result_for_an_idea_subject(client: TestClient) -> None:
    with SessionLocal() as db:
        idea = ideas_repo.create_idea(db, DEFAULT_USER_ID, IdeaCreate(body="asset target"))
        db.commit()
        idea_id = idea.id

        run_id = _enqueue(
            db,
            extractor="test-asset-producer",
            extractorVersion="0.0.1",
            subjectKind="idea",
            subjectId=f"idea:{idea_id}",
        ).id

    with SessionLocal() as db:
        result = worker.run_once(db)
        assert result is not None
        assert result.status == "succeeded"

        idea = ideas_repo.get_idea(db, DEFAULT_USER_ID, idea_id)
        assert idea is not None
        assets = idea_assets_repo.list_assets(db, idea)
        assert len(assets) == 1
        assert assets[0].role == "render"
        assert assets[0].run_id == run_id


def test_run_once_asset_out_for_a_non_idea_subject_fails_cleanly(client: TestClient) -> None:
    with SessionLocal() as db:
        run_id = _enqueue(
            db,
            extractor="test-asset-producer",
            extractorVersion="0.0.1",
            subjectKind="piece",
            subjectId="asset-on-a-piece",
        ).id

    with SessionLocal() as db:
        result = worker.run_once(db)
        assert result is not None
        assert result.status == "failed"
        assert result.error is not None
        assert "subject_kind='idea'" in result.error
        assert _properties_for(db, run_id) == []
