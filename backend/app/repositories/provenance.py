"""Data access for provenance runs and properties — owner-scoped like every
other repository in this app, plus the idempotent create paths `POST
/v1/runs` needs for its two body shapes (enqueue vs completed-run).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.provenance import ExtractedProperty, ExtractionRun
from app.provenance import CompletedRunStatus, Subject, canonical_params_hash, fold_input_sha256s
from app.schemas.provenance import PropertyIn, RunCreate


def _find_existing(
    db: Session, user_id: uuid.UUID, data: RunCreate, params_hash: str
) -> ExtractionRun | None:
    return db.scalar(
        select(ExtractionRun).where(
            ExtractionRun.user_id == user_id,
            ExtractionRun.subject_kind == data.subject_kind,
            ExtractionRun.subject_id == data.subject_id,
            ExtractionRun.extractor == data.extractor,
            ExtractionRun.extractor_version == data.extractor_version,
            ExtractionRun.params_hash == params_hash,
        )
    )


def get_or_create_queued_run(
    db: Session, user_id: uuid.UUID, data: RunCreate
) -> tuple[ExtractionRun, bool]:
    """`executor: 'worker'` — enqueue path. Returns `(run, created)`;
    `created is False` on an idempotent hit (same identity, already queued
    or since resolved), matching the 200-vs-201 contract the router applies.
    """
    merged_params = fold_input_sha256s(data.params, data.input_sha256s)
    params_hash = canonical_params_hash(merged_params)
    existing = _find_existing(db, user_id, data, params_hash)
    if existing is not None:
        return existing, False

    run = ExtractionRun(
        user_id=user_id,
        subject_kind=data.subject_kind,
        subject_id=data.subject_id,
        input_sha256s=sorted(data.input_sha256s),
        extractor=data.extractor,
        extractor_version=data.extractor_version,
        model_ref=data.model_ref,
        executor=data.executor,
        params=merged_params,
        params_hash=params_hash,
        status="queued",
    )
    db.add(run)
    db.flush()
    db.refresh(run)
    return run, True


def get_or_create_completed_run(
    db: Session,
    user_id: uuid.UUID,
    data: RunCreate,
    status: CompletedRunStatus,
    properties: list[PropertyIn],
    error: str | None,
) -> tuple[ExtractionRun, bool]:
    """`executor: 'client' | 'external'` — posted-complete path. The run and
    its properties land in one transaction; on an idempotent hit the posted
    `properties` are discarded and the existing row comes back unchanged.
    """
    merged_params = fold_input_sha256s(data.params, data.input_sha256s)
    params_hash = canonical_params_hash(merged_params)
    existing = _find_existing(db, user_id, data, params_hash)
    if existing is not None:
        return existing, False

    now = datetime.now(UTC)
    run = ExtractionRun(
        user_id=user_id,
        subject_kind=data.subject_kind,
        subject_id=data.subject_id,
        input_sha256s=sorted(data.input_sha256s),
        extractor=data.extractor,
        extractor_version=data.extractor_version,
        model_ref=data.model_ref,
        executor=data.executor,
        params=merged_params,
        params_hash=params_hash,
        status=status,
        started_at=now,
        finished_at=now,
        error=error,
    )
    db.add(run)
    # LOAD-BEARING: there is no `relationship()` anywhere in app/models (see
    # OwnedMixin's docstring) — every FK is a bare column constraint, so
    # SQLAlchemy's unit of work has no ORM-relationship dependency to order
    # this insert against the properties below. Without this flush, `run`
    # and its properties would be added to the session in one batch with no
    # guaranteed insert order: SQLite (PRAGMA foreign_keys off by default)
    # tolerates the FK arriving before its parent row exists; Postgres does
    # not and raises ForeignKeyViolation (found by OPS2, 2026-09-02, on
    # exactly this run+child-rows shape). Flushing here forces the run's
    # INSERT — and populates `run.id`, which every property below needs —
    # before a single `ExtractedProperty` is even constructed. Do not
    # "simplify" this away.
    db.flush()
    db.refresh(run)

    for prop in properties:
        db.add(
            ExtractedProperty(
                run_id=run.id,
                kind=prop.kind,
                time_range=prop.time_range,
                payload=prop.payload,
                confidence=prop.confidence,
            )
        )
    db.flush()
    return run, True


def get_run(db: Session, user_id: uuid.UUID, run_id: uuid.UUID) -> ExtractionRun | None:
    return db.scalar(
        select(ExtractionRun).where(ExtractionRun.id == run_id, ExtractionRun.user_id == user_id)
    )


def list_runs_for_subject(
    db: Session, user_id: uuid.UUID, subject: Subject, limit: int, offset: int
) -> tuple[list[ExtractionRun], int]:
    where = (
        ExtractionRun.user_id == user_id,
        ExtractionRun.subject_kind == subject.kind,
        ExtractionRun.subject_id == subject.id,
    )
    total = db.scalar(select(func.count(ExtractionRun.id)).where(*where)) or 0
    rows = db.scalars(
        select(ExtractionRun)
        .where(*where)
        .order_by(ExtractionRun.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total
