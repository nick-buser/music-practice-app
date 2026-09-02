"""ideas: ideas + idea_links

The object the sketchbook workstream is about — see docs/sketchbook.md.
JSON columns use `JSON().with_variant(JSONB(), "postgresql")`, matching
`app/models/idea.py`'s `IdeaJSON` alias (and `0002_provenance.py`'s
`ProvenanceJSON`) rather than `postgresql.JSONB()` directly, which only
compiles under the postgresql dialect and would break `alembic upgrade
head` against SQLite.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-02
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

IdeaJSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "ideas",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("handle", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("body", sa.String(), nullable=False, server_default=""),
        sa.Column("status", sa.String(), nullable=False, server_default="inbox"),
        sa.Column("kinds", IdeaJSON, nullable=False),
        sa.Column("tags", IdeaJSON, nullable=False),
        sa.Column("key", sa.String(), nullable=True),
        sa.Column("meter", sa.String(), nullable=True),
        sa.Column("bpm", sa.Integer(), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "handle", name="uq_ideas_user_handle"),
        sa.CheckConstraint("status IN ('inbox','active','shelved','done')", name="ck_ideas_status"),
    )
    op.create_index("ix_ideas_user_id", "ideas", ["user_id"])
    op.create_index("ix_ideas_handle", "ideas", ["handle"])
    op.create_index("ix_ideas_status", "ideas", ["status"])

    op.create_table(
        "idea_links",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("from_id", sa.Uuid(), nullable=False),
        sa.Column("to_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("note", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["from_id"], ["ideas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_id"], ["ideas.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("from_id", "to_id", "kind", name="uq_idea_links_from_to_kind"),
        sa.CheckConstraint(
            "kind IN ("
            "'derived_from','variant_of','resembles','might_fit_with','inspired_by',"
            "'incorporated_into','responds_to','mentions')",
            name="ck_idea_links_kind",
        ),
    )
    op.create_index("ix_idea_links_from_id", "idea_links", ["from_id"])
    op.create_index("ix_idea_links_to_id", "idea_links", ["to_id"])
    op.create_index("ix_idea_links_kind", "idea_links", ["kind"])


def downgrade() -> None:
    op.drop_table("idea_links")
    op.drop_table("ideas")
