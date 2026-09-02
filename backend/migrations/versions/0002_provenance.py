"""provenance: extraction_runs + extracted_properties

Every derived datum names its producer — see docs/recordings-provenance.md.
JSON columns use `JSON().with_variant(JSONB(), "postgresql")`, matching
`app/models/provenance.py`'s `ProvenanceJSON` alias, rather than
`postgresql.JSONB()` directly (as `0001_initial.py` uses for
`saved_chords.identity`) — the latter only compiles under the postgresql
dialect and breaks `alembic upgrade head` against SQLite; `with_variant`
degrades to plain `JSON` there instead.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-02
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ProvenanceJSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "extraction_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subject_kind", sa.String(), nullable=False),
        sa.Column("subject_id", sa.String(), nullable=False),
        sa.Column("input_sha256s", ProvenanceJSON, nullable=False),
        sa.Column("extractor", sa.String(), nullable=False),
        sa.Column("extractor_version", sa.String(), nullable=False),
        sa.Column("model_ref", sa.String(), nullable=True),
        sa.Column("executor", sa.String(), nullable=False),
        sa.Column("params", ProvenanceJSON, nullable=False),
        sa.Column("params_hash", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "subject_kind",
            "subject_id",
            "extractor",
            "extractor_version",
            "params_hash",
            name="uq_extraction_runs_identity",
        ),
        sa.CheckConstraint(
            "executor IN ('worker','client','external')", name="ck_extraction_runs_executor"
        ),
        sa.CheckConstraint(
            "status IN ('queued','running','succeeded','failed')",
            name="ck_extraction_runs_status",
        ),
    )
    op.create_index("ix_extraction_runs_user_id", "extraction_runs", ["user_id"])
    op.create_index("ix_extraction_runs_subject_kind", "extraction_runs", ["subject_kind"])
    op.create_index("ix_extraction_runs_subject_id", "extraction_runs", ["subject_id"])
    op.create_index("ix_extraction_runs_extractor", "extraction_runs", ["extractor"])
    op.create_index("ix_extraction_runs_params_hash", "extraction_runs", ["params_hash"])
    op.create_index("ix_extraction_runs_status", "extraction_runs", ["status"])

    op.create_table(
        "extracted_properties",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("time_range", ProvenanceJSON, nullable=True),
        sa.Column("payload", ProvenanceJSON, nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["extraction_runs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_extracted_properties_run_id", "extracted_properties", ["run_id"])
    op.create_index("ix_extracted_properties_kind", "extracted_properties", ["kind"])


def downgrade() -> None:
    op.drop_table("extracted_properties")
    op.drop_table("extraction_runs")
