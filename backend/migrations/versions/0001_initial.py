"""initial schema: users, saved_chords, practice_sessions (+ default user)

`saved_chords.identity` originally used `postgresql.JSONB()` directly, which
only compiles under the postgresql dialect and breaks `alembic upgrade head`
against SQLite (see `0002_provenance.py`'s docstring, which named this bug).
It's rewritten here to `JSON().with_variant(JSONB(), "postgresql")` as
`IdentityJSON`, matching `app/models/chord.py`'s `IdentityJSON` alias and the
pattern every later revision already follows. On PostgreSQL `with_variant`
renders `JSONB` exactly as the bare type did, so already-migrated databases
are completely unaffected — this is a no-op there. The revision id is
unchanged; only the chain's ability to run locally under SQLite changes.

Revision ID: 0001
Revises:
Create Date: 2026-05-31
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

IdentityJSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "saved_chords",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("identity", IdentityJSON, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_saved_chords_user_id", "saved_chords", ["user_id"])

    op.create_table(
        "practice_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subject_id", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bpm", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_practice_sessions_user_id", "practice_sessions", ["user_id"])
    op.create_index("ix_practice_sessions_subject_id", "practice_sessions", ["subject_id"])

    users = sa.table("users", sa.column("id", sa.Uuid()), sa.column("display_name", sa.String()))
    op.bulk_insert(users, [{"id": DEFAULT_USER_ID, "display_name": "Default User"}])


def downgrade() -> None:
    op.drop_table("practice_sessions")
    op.drop_table("saved_chords")
    op.drop_table("users")
