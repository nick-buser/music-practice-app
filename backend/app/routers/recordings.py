"""CRUD for recordings — see docs/recordings-provenance.md. Track upload and
streaming download live in `app/routers/recording_tracks.py`, mirroring how
idea assets get their own router alongside `app/routers/ideas.py`.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.deps import CurrentUserDep, DbSession, PageParamsDep
from app.errors import not_found
from app.models.recording import Recording, RecordingTrack
from app.repositories import recording_tracks as tracks_repo
from app.repositories import recordings as repo
from app.schemas.common import Page
from app.schemas.recording import (
    RecordingCreate,
    RecordingRead,
    RecordingSummary,
    RecordingTrackRead,
    RecordingUpdate,
)

router = APIRouter(prefix="/recordings", tags=["recordings"])


def _to_read(recording: Recording, tracks: list[RecordingTrack]) -> RecordingRead:
    return RecordingRead(
        id=recording.id,
        subject_kind=recording.subject_kind,
        subject_id=recording.subject_id,
        session_id=recording.session_id,
        captured_at=recording.captured_at,
        duration_ms=recording.duration_ms,
        notes=recording.notes,
        created_at=recording.created_at,
        updated_at=recording.updated_at,
        tracks=[RecordingTrackRead.model_validate(t) for t in tracks],
    )


@router.get("", response_model=Page[RecordingSummary])
def list_recordings(
    db: DbSession,
    user: CurrentUserDep,
    page: PageParamsDep,
    subject_kind: Annotated[str | None, Query(alias="subjectKind")] = None,
    subject_id: Annotated[str | None, Query(alias="subjectId")] = None,
) -> Page[RecordingSummary]:
    items, total = repo.list_recordings(
        db, user.id, page.limit, page.offset, subject_kind, subject_id
    )
    return Page(
        items=[RecordingSummary.model_validate(r) for r in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.post("", response_model=RecordingRead, status_code=status.HTTP_201_CREATED)
def create_recording(data: RecordingCreate, db: DbSession, user: CurrentUserDep) -> RecordingRead:
    recording = repo.create_recording(db, user.id, data)
    # A freshly-created recording has no tracks yet — attached afterward via
    # `POST /v1/recordings/{id}/tracks` (`app/routers/recording_tracks.py`).
    return _to_read(recording, [])


@router.get("/{recording_id}", response_model=RecordingRead)
def get_recording(recording_id: uuid.UUID, db: DbSession, user: CurrentUserDep) -> RecordingRead:
    recording = repo.get_recording(db, user.id, recording_id)
    if recording is None:
        raise not_found("Recording")
    tracks = tracks_repo.list_tracks(db, recording)
    return _to_read(recording, tracks)


@router.patch("/{recording_id}", response_model=RecordingRead)
def update_recording(
    recording_id: uuid.UUID, data: RecordingUpdate, db: DbSession, user: CurrentUserDep
) -> RecordingRead:
    recording = repo.get_recording(db, user.id, recording_id)
    if recording is None:
        raise not_found("Recording")
    recording = repo.update_recording(db, recording, data)
    tracks = tracks_repo.list_tracks(db, recording)
    return _to_read(recording, tracks)


@router.delete("/{recording_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recording(recording_id: uuid.UUID, db: DbSession, user: CurrentUserDep) -> None:
    recording = repo.get_recording(db, user.id, recording_id)
    if recording is None:
        raise not_found("Recording")
    repo.soft_delete_recording(db, recording)
