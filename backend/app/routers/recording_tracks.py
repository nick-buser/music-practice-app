"""Recording-track upload and streaming download — mirrors
`app/routers/idea_assets.py` closely (RC1's ticket, verbatim: "Your two
upload/download routes mirror these directly, including the cap"). Reuses
that module's `_CappedStream`/`_too_large` rather than re-implementing the
same oversize-upload guard a second time — see `_CappedStream`'s own
docstring there for why raising mid-`read()` is what keeps a rejected
upload from ever landing a partial object in the store.
"""

from __future__ import annotations

import uuid
from typing import Annotated, BinaryIO, cast

from fastapi import APIRouter, File, Form, Header, UploadFile, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.deps import CurrentUserDep, DbSession, MediaStoreDep
from app.errors import not_found
from app.recordings import RecordingTrackKind
from app.repositories import recording_tracks as repo
from app.repositories import recordings as recordings_repo
from app.routers.idea_assets import (
    _CappedStream,  # pyright: ignore[reportPrivateUsage]
    _too_large,  # pyright: ignore[reportPrivateUsage]
)
from app.schemas.recording import RecordingTrackRead
from app.storage import stream_blob_response

router = APIRouter(prefix="/recordings", tags=["recording-tracks"])


@router.post(
    "/{recording_id}/tracks",
    response_model=RecordingTrackRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_track(
    recording_id: uuid.UUID,
    db: DbSession,
    user: CurrentUserDep,
    store: MediaStoreDep,
    file: Annotated[UploadFile, File()],
    kind: Annotated[RecordingTrackKind, Form()],
    # Track start minus `recording.captured_at` — see
    # `app/models/recording.py::RecordingTrack.offset_ms`. Defaults to 0
    # (the common case: a track that starts exactly on the recording clock).
    offset_ms: Annotated[int, Form(alias="offsetMs")] = 0,
    # See `app/routers/idea_assets.py::upload_asset` for why this is only
    # a best-effort pre-check, not the authoritative cap.
    content_length: Annotated[int | None, Header()] = None,
) -> RecordingTrackRead:
    max_bytes = settings.media_max_upload_bytes
    if content_length is not None and content_length > max_bytes:
        raise _too_large(max_bytes)

    recording = recordings_repo.get_recording(db, user.id, recording_id)
    if recording is None:
        raise not_found("Recording")

    capped = _CappedStream(file.file, max_bytes)
    mime = file.content_type or "application/octet-stream"
    blob = store.put_stream(cast(BinaryIO, capped), mime)

    track = repo.create_track(db, recording, kind=kind, offset_ms=offset_ms, blob=blob)
    return RecordingTrackRead.model_validate(track)


# See `app/routers/idea_assets.py::download_asset`'s neighbouring comment:
# `-> StreamingResponse` alone documents the wrong media type, so the
# `responses=` entry below is what makes the generated TS client correct.
@router.get(
    "/{recording_id}/tracks/{track_id}/content",
    response_class=StreamingResponse,
    responses={200: {"content": {"application/octet-stream": {}}}},
)
def download_track(
    recording_id: uuid.UUID,
    track_id: uuid.UUID,
    db: DbSession,
    user: CurrentUserDep,
    store: MediaStoreDep,
) -> StreamingResponse:
    recording = recordings_repo.get_recording(db, user.id, recording_id)
    if recording is None:
        raise not_found("Recording")
    track = repo.get_track(db, recording, track_id)
    if track is None:
        raise not_found("Track")
    stat = store.stat(track.storage_key)
    if stat is None:
        # Should not happen — raw is immortal (docs/recordings-provenance.md)
        # — but a track row naming bytes the store no longer has is still a
        # 404 for this specific piece of content, not a 500.
        raise not_found("Track content")
    return stream_blob_response(store, track.storage_key, track.sha256, stat)
