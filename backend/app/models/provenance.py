"""Provenance tables: every derived datum names its producer.

Two tables carry the whole rule (see docs/recordings-provenance.md):
`ExtractionRun` is the producer's account of itself — what ran, on what
inputs, with what params, and what it concluded — and `ExtractedProperty` is
one derived fact it produced, tied to exactly one run. Runs are **immutable**
once written: re-extraction is a new row, never an edit, so the API exposes
no PATCH and this model carries no `SoftDeleteMixin` — nothing here is ever
soft-deleted in place either, a correction is a new run superseding the old
one in reads (`app.provenance.latest_properties`), not a deletion.

`executor`/`status` are plain `String` columns with a `CheckConstraint`
rather than a SQLAlchemy `Enum` type: nothing else in `app/models/` uses
`Enum`, and `native_enum=True` would mean a real Postgres `CREATE TYPE` that
the downgrade in `migrations/versions/0002_provenance.py` would also have to
drop — a CHECK constraint gets the same guarantee and disappears for free
when the table does.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OwnedMixin, PKMixin, TimestampMixin
from app.provenance import Executor, RunStatus

# JSONB on Postgres (indexable, queryable); plain JSON on SQLite for fast tests.
ProvenanceJSON = JSON().with_variant(JSONB(), "postgresql")


class ExtractionRun(PKMixin, OwnedMixin, TimestampMixin, Base):
    __tablename__ = "extraction_runs"
    __table_args__ = (
        # `params` always carries the sorted `input_sha256s` (folded in by
        # `app.provenance.fold_input_sha256s` before hashing), so two
        # different inputs of one subject never collide here — asking twice
        # for the same extraction is a cache hit, not a duplicate.
        UniqueConstraint(
            "subject_kind",
            "subject_id",
            "extractor",
            "extractor_version",
            "params_hash",
            name="uq_extraction_runs_identity",
        ),
        CheckConstraint(
            "executor IN ('worker','client','external')", name="ck_extraction_runs_executor"
        ),
        CheckConstraint(
            "status IN ('queued','running','succeeded','failed')",
            name="ck_extraction_runs_status",
        ),
    )

    # The house subject form: `kind:<uuid>` for uuid-backed kinds, the bare
    # bundled id for piece/scale — matches `practice_sessions.subject_id`.
    # `subject_kind` is denormalised off it purely so queries can filter on
    # kind without parsing `subject_id`.
    subject_kind: Mapped[str] = mapped_column(String, index=True)
    subject_id: Mapped[str] = mapped_column(String, index=True)
    input_sha256s: Mapped[list[str]] = mapped_column(ProvenanceJSON, nullable=False)
    extractor: Mapped[str] = mapped_column(String, index=True)
    extractor_version: Mapped[str] = mapped_column(String)
    model_ref: Mapped[str | None] = mapped_column(String, default=None)
    executor: Mapped[Executor] = mapped_column(String)
    # Canonicalised (sorted keys, `inputSha256s` folded in) before hashing —
    # see `app.provenance.canonical_params_hash`.
    params: Mapped[dict[str, Any]] = mapped_column(ProvenanceJSON, nullable=False)
    params_hash: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[RunStatus] = mapped_column(String, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    error: Mapped[str | None] = mapped_column(String, default=None)


class ExtractedProperty(PKMixin, Base):
    """One derived fact, produced by exactly one run — no orphaned numbers.

    No `OwnedMixin`/`TimestampMixin` here: ownership and "when" both live on
    the producing run (`run_id` names it, `run.finished_at` times it), and
    the contract's column list stops exactly at what a property is — adding
    parallel bookkeeping columns nothing reads would just be noise.
    """

    __tablename__ = "extracted_properties"

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("extraction_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String, index=True)
    time_range: Mapped[dict[str, Any] | None] = mapped_column(ProvenanceJSON, default=None)
    payload: Mapped[dict[str, Any]] = mapped_column(ProvenanceJSON, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, default=None)
