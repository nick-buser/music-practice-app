"""Data access for recording cadences — owner-scoped like every other
repository in this app. See `app/models/recording.py`'s `RecordingCadence`
docstring for the (user, subject_kind, subject_id) upsert key and the
NULL-means-"off" `interval_days` convention this repository just carries
through, without re-deciding either.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.recording import RecordingCadence


def list_cadences(db: Session, user_id: uuid.UUID) -> list[RecordingCadence]:
    """Every cadence this user has ever set — RC3 doesn't ask for a subject
    filter (that's the `PUT`/get-single path's job), so the frontend fetches
    the whole small set once and looks up its subject client-side, mirroring
    how `useRecordings` already reads `RecordingSummary`/`RecordingRead`.
    """
    return list(
        db.scalars(
            select(RecordingCadence)
            .where(RecordingCadence.user_id == user_id)
            .order_by(RecordingCadence.subject_kind, RecordingCadence.subject_id)
        )
    )


def get_cadence(
    db: Session, user_id: uuid.UUID, subject_kind: str, subject_id: str
) -> RecordingCadence | None:
    return db.scalar(
        select(RecordingCadence).where(
            RecordingCadence.user_id == user_id,
            RecordingCadence.subject_kind == subject_kind,
            RecordingCadence.subject_id == subject_id,
        )
    )


def upsert_cadence(
    db: Session,
    user_id: uuid.UUID,
    subject_kind: str,
    subject_id: str,
    interval_days: int | None,
) -> tuple[RecordingCadence, bool]:
    """Get-or-create-then-update, keyed on the `uq_recording_cadences_subject`
    unique constraint. Returns `(cadence, created)` — mirroring
    `app.repositories.provenance.get_or_create_queued_run`'s pair — so the
    router can answer 201 on first creation and 200 on every later `PUT`,
    while a second `PUT` for the same subject always updates this same row
    rather than inserting a sibling (RC3 acceptance criterion 2).
    """
    cadence = get_cadence(db, user_id, subject_kind, subject_id)
    if cadence is not None:
        cadence.interval_days = interval_days
        db.flush()
        db.refresh(cadence)
        return cadence, False

    cadence = RecordingCadence(
        user_id=user_id,
        subject_kind=subject_kind,
        subject_id=subject_id,
        interval_days=interval_days,
    )
    db.add(cadence)
    db.flush()
    db.refresh(cadence)
    return cadence, True
