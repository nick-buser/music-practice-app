"""idea_assets: sketchbook attachments, revisions, and the run_id FK

See docs/sketchbook.md's "Attachments" section and
`app/models/idea.py::IdeaAsset`. No JSON columns here, so unlike
`0002_provenance.py`/`0003_ideas.py` there is no `with_variant` alias to
define.

This migration also adds `idea_assets.run_id -> extraction_runs.id`: the
grooming doc assigns that FK to whichever of SB2/PV1 lands second, and PV1
(0002, `extraction_runs`) already landed — so it is added here, not there.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-02
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "idea_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("idea_id", sa.Uuid(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("mime", sa.String(), nullable=False),
        sa.Column("bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["idea_id"], ["ideas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["extraction_runs.id"], ondelete="CASCADE"),
        sa.CheckConstraint("revision >= 1", name="ck_idea_assets_revision_positive"),
        sa.CheckConstraint(
            "role IN ("
            "'melody','harmony','bass','drums','full','render','score','rpp',"
            "'reference','image','other')",
            name="ck_idea_assets_role",
        ),
    )
    op.create_index("ix_idea_assets_idea_id", "idea_assets", ["idea_id"])
    op.create_index("ix_idea_assets_role", "idea_assets", ["role"])
    op.create_index("ix_idea_assets_storage_key", "idea_assets", ["storage_key"])
    op.create_index("ix_idea_assets_sha256", "idea_assets", ["sha256"])
    op.create_index("ix_idea_assets_run_id", "idea_assets", ["run_id"])


def downgrade() -> None:
    op.drop_table("idea_assets")
