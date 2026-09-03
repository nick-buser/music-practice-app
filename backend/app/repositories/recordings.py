"""Data access for recordings — owner-scoped like every other repository in
this app. See docs/recordings-provenance.md and `app/models/recording.py`.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.recording import Recording
from app.schemas.recording import RecordingCreate, RecordingUpdate


def list_recordings(
    db: Session,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
    subject_kind: str | None,
    subject_id: str | None,
) -> tuple[list[Recording], int]:
    """Newest first (`captured_at desc`). `subject_kind`/`subject_id` filter
    independently when given — mirroring `app.repositories.ideas.list_ideas`'s
    `kind`/`tag` params — and, critically, an absent `subject_kind` (the
    default) applies **no** subject filter at all: every recording is
    returned, subject-bearing and subject-less alike. A caller that wants
    only subject-less rows has no filter value to pass for that (subject
    columns are NULL, not an empty string) — not this ticket's concern, and
    not what RC1's acceptance criterion 2 tests (it only pins that omitting
    the filter never excludes them).
    """
    where = [Recording.user_id == user_id, Recording.deleted_at.is_(None)]
    if subject_kind is not None:
        where.append(Recording.subject_kind == subject_kind)
    if subject_id is not None:
        where.append(Recording.subject_id == subject_id)
    total = db.scalar(select(func.count(Recording.id)).where(*where)) or 0
    rows = db.scalars(
        select(Recording)
        .where(*where)
        .order_by(Recording.captured_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total


def get_recording(db: Session, user_id: uuid.UUID, recording_id: uuid.UUID) -> Recording | None:
    return db.scalar(
        select(Recording).where(
            Recording.id == recording_id,
            Recording.user_id == user_id,
            Recording.deleted_at.is_(None),
        )
    )


def create_recording(db: Session, user_id: uuid.UUID, data: RecordingCreate) -> Recording:
    recording = Recording(
        user_id=user_id,
        subject_kind=data.subject_kind,
        subject_id=data.subject_id,
        session_id=data.session_id,
        captured_at=data.captured_at,
        duration_ms=data.duration_ms,
        notes=data.notes,
    )
    if data.id is not None:
        recording.id = data.id
    db.add(recording)
    db.flush()
    db.refresh(recording)
    return recording


def update_recording(db: Session, recording: Recording, data: RecordingUpdate) -> Recording:
    if data.duration_ms is not None:
        recording.duration_ms = data.duration_ms
    if data.notes is not None:
        recording.notes = data.notes
    db.flush()
    db.refresh(recording)
    return recording


def soft_delete_recording(db: Session, recording: Recording) -> None:
    recording.deleted_at = datetime.now(UTC)
    db.flush()
