"""recordings + recording_tracks: the tables the capture UI, the extractors,
and tempo-vs-target all hang on. See docs/recordings-provenance.md and
`app/models/recording.py`.

No JSON columns here, so — like 0004_idea_assets.py — there is no
`with_variant` alias to define.

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-02
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recordings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subject_kind", sa.String(), nullable=True),
        sa.Column("subject_id", sa.String(), nullable=True),
        sa.Column("session_id", sa.Uuid(), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["practice_sessions.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "(subject_kind IS NULL) = (subject_id IS NULL)",
            name="ck_recordings_subject_pair",
        ),
    )
    op.create_index("ix_recordings_user_id", "recordings", ["user_id"])
    op.create_index("ix_recordings_subject_kind", "recordings", ["subject_kind"])
    op.create_index("ix_recordings_subject_id", "recordings", ["subject_id"])
    op.create_index("ix_recordings_session_id", "recordings", ["session_id"])

    op.create_table(
        "recording_tracks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("recording_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("mime", sa.String(), nullable=False),
        sa.Column("bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(), nullable=False),
        sa.Column("offset_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["recording_id"], ["recordings.id"], ondelete="CASCADE"),
        sa.CheckConstraint("kind IN ('audio','midi')", name="ck_recording_tracks_kind"),
    )
    op.create_index("ix_recording_tracks_recording_id", "recording_tracks", ["recording_id"])
    op.create_index("ix_recording_tracks_kind", "recording_tracks", ["kind"])
    op.create_index("ix_recording_tracks_storage_key", "recording_tracks", ["storage_key"])
    op.create_index("ix_recording_tracks_sha256", "recording_tracks", ["sha256"])


def downgrade() -> None:
    op.drop_table("recording_tracks")
    op.drop_table("recordings")
