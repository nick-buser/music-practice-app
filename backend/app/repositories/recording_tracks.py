"""Data access for recording tracks — owner-scoped indirectly through the
parent `Recording`, mirroring `app/repositories/idea_assets.py`.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.recording import Recording, RecordingTrack
from app.recordings import RecordingTrackKind
from app.storage import StoredBlob


def create_track(
    db: Session,
    recording: Recording,
    *,
    kind: RecordingTrackKind,
    offset_ms: int,
    blob: StoredBlob,
) -> RecordingTrack:
    """Attaches `blob` to `recording` as a new track.

    `recording` must already be a persisted row — every caller loads it via
    `app.repositories.recordings.get_recording` before reaching here, never
    constructs one in this same transaction — so there is no cross-insert
    ordering hazard for `recording_id` here, mirroring
    `app.repositories.idea_assets.create_asset`'s docstring on the same
    point for `idea_id`.
    """
    track = RecordingTrack(
        recording_id=recording.id,
        kind=kind,
        storage_key=blob.storage_key,
        mime=blob.mime,
        bytes=blob.size_bytes,
        sha256=blob.sha256,
        offset_ms=offset_ms,
    )
    db.add(track)
    db.flush()
    db.refresh(track)
    return track


def list_tracks(db: Session, recording: Recording) -> list[RecordingTrack]:
    """Insertion order — recording tracks have no revision concept to sort
    by (unlike `app.repositories.idea_assets.list_assets`).
    """
    return list(
        db.scalars(
            select(RecordingTrack)
            .where(
                RecordingTrack.recording_id == recording.id,
                RecordingTrack.deleted_at.is_(None),
            )
            .order_by(RecordingTrack.created_at)
        )
    )


def get_track(db: Session, recording: Recording, track_id: uuid.UUID) -> RecordingTrack | None:
    return db.scalar(
        select(RecordingTrack).where(
            RecordingTrack.id == track_id,
            RecordingTrack.recording_id == recording.id,
            RecordingTrack.deleted_at.is_(None),
        )
    )
