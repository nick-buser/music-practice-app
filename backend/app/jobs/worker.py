"""The job worker: enqueue→poll, never inline (PV2 — see
`.tickets/_grooming-sketchbook-and-media.md`'s PV2 entry and
`docs/recordings-provenance.md`).

`run_once` claims and executes at most one queued `ExtractionRun`.
`run_forever` is the poll loop `app.main`'s embedded daemon thread runs, and
what `python -m app.jobs.worker` (no flag) runs standalone — that entry
point exists now so a future dedicated worker Deployment (gitops, if ever
needed) is a config change, not a code change. `--once` is the ops/cron
shape: process at most one queued run and exit.

There is no broker and no retry policy here on purpose — "the thinnest
thing that works" (PV2's own words). A `failed` run just sits there,
`error` populated, for a human or a future retry ticket to look at; nothing
here re-queues it.
"""

from __future__ import annotations

import argparse
import io
import time
import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.deps import get_media_store
from app.jobs.registry import AssetOut, ExtractorContext, PropertyOut, get_extractor
from app.models.idea import Idea
from app.models.provenance import ExtractedProperty, ExtractionRun
from app.repositories import idea_assets as idea_assets_repo
from app.storage import MediaStore

log = structlog.get_logger()


def _claim_oldest_queued(db: Session) -> ExtractionRun | None:
    """Claim the oldest `queued` run, flip it to `running`, and commit that
    flip immediately — a short transaction of its own, deliberately not
    merged into the execute-and-finish transaction in `run_once`, so a run
    visibly shows `running` (e.g. to a `GET /runs/{id}` poller) for the
    whole duration of extraction, however long that takes.

    `FOR UPDATE SKIP LOCKED` (Postgres only — `db.bind.dialect.name` is the
    branch) is what makes "two `run_once` calls never double-execute one
    run" hold under *real* concurrency: two workers each opening this same
    SELECT inside their own transaction, whichever reaches it first locks
    the row and the second's SKIP LOCKED skips straight over it rather than
    blocking on it or (worse) returning it a second time. On SQLite this
    degrades to a plain SELECT with no locking at all — single-process-safe
    only, which is exactly what this app's SQLite setup is (`app/db.py`'s
    shared `StaticPool` connection has no meaningful concurrent-transaction
    scenario to lock against in the first place). `tests/test_worker.py`
    therefore proves *sequential* double-claim (call `run_once` twice, the
    second finds nothing left to claim), not a proof of the Postgres path
    under real concurrency — that guarantee comes from the SQL semantics of
    `FOR UPDATE SKIP LOCKED` itself, not from a SQLite-backed test.

    Either way, once this function commits the `running` flip, a later
    call — concurrent or sequential — simply won't find this row again via
    `WHERE status == 'queued'`, locking or no locking.
    """
    stmt = (
        select(ExtractionRun)
        .where(ExtractionRun.status == "queued")
        .order_by(ExtractionRun.created_at)
        .limit(1)
    )
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update(skip_locked=True)
    run = db.scalar(stmt)
    if run is None:
        return None
    run.status = "running"
    run.started_at = datetime.now(UTC)
    db.commit()
    db.refresh(run)
    return run


def _write_asset(db: Session, run: ExtractionRun, store: MediaStore, asset: AssetOut) -> None:
    """See `AssetOut`'s docstring (`app/jobs/registry.py`) for why this is
    scoped to `subject_kind == 'idea'` only.
    """
    if run.subject_kind != "idea":
        raise NotImplementedError(
            f"AssetOut is only wired for subject_kind='idea' today; extractor "
            f"{run.extractor!r} returned one for subject_kind={run.subject_kind!r}."
        )
    idea_id = uuid.UUID(run.subject_id.removeprefix("idea:"))
    idea = db.get(Idea, idea_id)
    if idea is None:
        raise ValueError(f"run {run.id} names idea {idea_id}, which no longer exists")
    blob = store.put_stream(io.BytesIO(asset.data), asset.mime)
    idea_assets_repo.create_asset(
        db,
        idea,
        role=asset.role,
        filename=asset.filename,
        blob=blob,
        new_revision=False,
        run_id=run.id,
    )


def _write_result(db: Session, run: ExtractionRun, store: MediaStore, result: object) -> None:
    # `result` is typed `object`, not `PropertyOut | AssetOut` (what
    # `Extractor.run` declares), purely so both `isinstance` checks below
    # are real runtime narrowing rather than pyright-flagged tautologies —
    # an extractor is arbitrary code, and a bad return value should raise
    # this module's own clear `TypeError`, not surface as an `AttributeError`
    # three lines further down.
    if isinstance(result, PropertyOut):
        db.add(
            ExtractedProperty(
                run_id=run.id,
                kind=result.kind,
                time_range=result.time_range,
                payload=result.payload,
                confidence=result.confidence,
            )
        )
    elif isinstance(result, AssetOut):
        _write_asset(db, run, store, result)
    else:
        raise TypeError(
            f"extractor {run.extractor!r} returned an unsupported result type: {type(result)!r}"
        )


def _mark_failed(db: Session, run_id: uuid.UUID, error: str) -> ExtractionRun:
    # Re-fetched by id rather than reusing the `run` object `run_once` had:
    # the `db.rollback()` just before this call expires every object in the
    # session, and re-fetching (instead of relying on lazy-reload-on-access)
    # keeps this function's contract obvious on its own.
    run = db.get(ExtractionRun, run_id)
    assert run is not None, "run vanished between claim and failure write"
    run.status = "failed"
    run.error = error
    run.finished_at = datetime.now(UTC)
    db.commit()
    db.refresh(run)
    return run


def run_once(db: Session) -> ExtractionRun | None:
    """Claim the oldest queued run and execute it to a terminal status.

    Returns the run it processed (`succeeded` or `failed`), or `None` if
    there was no queued run to claim. One transaction covers the success
    path — every written property/asset plus the `succeeded` flip commit
    together (`db.commit()` below); on any exception (from an unknown
    extractor name, the extractor itself, or writing its results) that
    transaction is rolled back first, so no partial property/asset ever
    survives a failed run, and `failed` + `error` are written as a
    separate, always-succeeding step via `_mark_failed`.
    """
    run = _claim_oldest_queued(db)
    if run is None:
        return None

    run_id = run.id
    extractor_name = run.extractor
    store = get_media_store()
    try:
        extractor = get_extractor(extractor_name)
        ctx = ExtractorContext(run=run, store=store)
        results = extractor.run(ctx)
        for result in results:
            _write_result(db, run, store, result)
        run.status = "succeeded"
        run.finished_at = datetime.now(UTC)
        db.commit()
    except Exception as exc:
        db.rollback()
        log.warning(
            "extraction_run_failed", run_id=str(run_id), extractor=extractor_name, error=str(exc)
        )
        return _mark_failed(db, run_id, str(exc))

    db.refresh(run)
    log.info("extraction_run_succeeded", run_id=str(run_id), extractor=extractor_name)
    return run


def run_forever(poll_seconds: float | None = None) -> None:
    """The poll loop: one `SessionLocal()` per attempt (never one long-lived
    session for the thread's whole life), matching the request-scoped
    session lifecycle everywhere else in this app (`app/db.py::get_db`) and
    ensuring a stuck/expired session from one run never carries into the
    next poll. Runs until the process exits — the embedded caller
    (`app.main`'s lifespan) starts this on a daemon thread, so process exit
    is the only stop condition and needs no explicit signal here.
    """
    interval = poll_seconds if poll_seconds is not None else settings.worker_poll_seconds
    log.info("worker_started", poll_seconds=interval)
    while True:
        try:
            with SessionLocal() as db:
                run = run_once(db)
        except Exception:
            # A poll attempt failing outright (DB unreachable, etc.) must
            # not kill the loop — that would silently stop every future
            # queued run from ever being picked up until the next deploy.
            log.exception("worker_poll_failed")
            run = None
        if run is None:
            time.sleep(interval)


def _run_once_cli() -> None:
    with SessionLocal() as db:
        run = run_once(db)
    if run is None:
        log.info("worker_once_no_queued_run")
    else:
        log.info("worker_once_processed", run_id=str(run.id), status=run.status)


def main() -> None:
    parser = argparse.ArgumentParser(description="Soundings job worker (PV2)")
    parser.add_argument(
        "--once", action="store_true", help="Process at most one queued run, then exit"
    )
    args = parser.parse_args()
    if args.once:
        _run_once_cli()
    else:
        run_forever()


if __name__ == "__main__":
    main()
