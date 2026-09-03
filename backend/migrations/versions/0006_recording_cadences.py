"""recording_cadences: RC3's "record this weekly" table. No JSON columns, so
— like 0005_recordings.py — there is no `with_variant` alias to define, and
no scheduler-facing columns either (due-ness is computed on read, never by a
background job — see `app/models/recording.py`'s `RecordingCadence`
docstring).

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-03
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recording_cadences",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subject_kind", sa.String(), nullable=False),
        sa.Column("subject_id", sa.String(), nullable=False),
        # NULL = "off" — see the model docstring for why this, not `0` or a
        # deleted row, is the one representation of "no cadence".
        sa.Column("interval_days", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "user_id", "subject_kind", "subject_id", name="uq_recording_cadences_subject"
        ),
        sa.CheckConstraint(
            "interval_days IS NULL OR interval_days > 0",
            name="ck_recording_cadences_interval_positive",
        ),
    )
    op.create_index("ix_recording_cadences_user_id", "recording_cadences", ["user_id"])
    op.create_index("ix_recording_cadences_subject_kind", "recording_cadences", ["subject_kind"])
    op.create_index("ix_recording_cadences_subject_id", "recording_cadences", ["subject_id"])


def downgrade() -> None:
    op.drop_table("recording_cadences")
