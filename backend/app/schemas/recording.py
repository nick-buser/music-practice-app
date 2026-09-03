"""Wire schemas for the recordings API — see docs/recordings-provenance.md
and `app/models/recording.py`.

There is deliberately no `RecordingTrackCreate`: `POST
/v1/recordings/{id}/tracks` is `multipart/form-data` (a streamed file plus
form fields), not JSON, so FastAPI's own `Form`/`File` parameters describe
that request body (`app/routers/recording_tracks.py`) rather than a
`CamelModel` — exactly as `app/schemas/idea_asset.py` explains for
`IdeaAsset`.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.recordings import RecordingTrackKind
from app.schemas.base import CamelModel


class RecordingCreate(CamelModel):
    # Clients may mint the id (offline-first), matching every other Create
    # schema in this app.
    id: uuid.UUID | None = None
    # Both unset together for free practice and sketchbook voice captures —
    # see `app/models/recording.py`'s docstring for the pairing rule (a DB
    # `CheckConstraint`, not validated again here).
    subject_kind: str | None = None
    subject_id: str | None = None
    session_id: uuid.UUID | None = None
    # Required, unlike `IdeaCreate.captured_at` — a capture always knows
    # exactly when it started; there is no "now" default to fall back to.
    captured_at: datetime
    # Bounds keep an absurd value out of the DB integer column (→ 422, not a
    # 500 overflow) and double as a sane domain limit (≤ 24h), matching
    # `PracticeSessionCreate.duration_seconds`'s reasoning.
    duration_ms: int | None = Field(default=None, ge=0, le=86_400_000)
    notes: str | None = None


class RecordingUpdate(CamelModel):
    duration_ms: int | None = Field(default=None, ge=0, le=86_400_000)
    notes: str | None = None


class RecordingTrackRead(CamelModel):
    id: uuid.UUID
    recording_id: uuid.UUID
    kind: RecordingTrackKind
    storage_key: str
    mime: str
    bytes: int
    sha256: str
    offset_ms: int
    created_at: datetime
    updated_at: datetime


class RecordingSummary(CamelModel):
    """The list-view shape — no tracks, so `GET /v1/recordings` stays one
    query per page rather than N+1 (see `RecordingRead` for the
    single-recording shape that does carry them) — the same split
    `IdeaSummary`/`IdeaRead` use in `app/schemas/idea.py`, for the same
    reason.
    """

    id: uuid.UUID
    subject_kind: str | None
    subject_id: str | None
    session_id: uuid.UUID | None
    captured_at: datetime
    duration_ms: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class RecordingRead(RecordingSummary):
    tracks: list[RecordingTrackRead]


class RecordingCadenceUpdate(CamelModel):
    """The `PUT .../{subject_kind}/{subject_id}` body — RC3. `None` is "off"
    (see `RecordingCadence`'s docstring in `app/models/recording.py` for why
    that, and not `0` or a DELETE, is the one representation); a set value
    is bounded the same way `RecordingCreate.duration_ms` bounds its field —
    a sane domain limit (≤ 10 years) keeps an absurd value a 422, not a
    silently-accepted row nothing will ever hit.
    """

    interval_days: int | None = Field(default=None, ge=1, le=3650)


class RecordingCadenceRead(CamelModel):
    id: uuid.UUID
    subject_kind: str
    subject_id: str
    interval_days: int | None
    created_at: datetime
    updated_at: datetime
