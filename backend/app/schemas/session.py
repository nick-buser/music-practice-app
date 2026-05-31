from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.base import CamelModel

# Bounds keep absurd inputs out of the DB integer columns (→ 422, not a 500
# overflow) and double as sane domain limits (≤ 24h; plausible tempo range).


class PracticeSessionCreate(CamelModel):
    id: uuid.UUID | None = None
    subject_id: str
    started_at: datetime
    duration_seconds: int = Field(default=0, ge=0, le=86_400)
    bpm: int | None = Field(default=None, ge=1, le=400)
    notes: str | None = None


class PracticeSessionUpdate(CamelModel):
    duration_seconds: int | None = Field(default=None, ge=0, le=86_400)
    bpm: int | None = Field(default=None, ge=1, le=400)
    notes: str | None = None


class PracticeSessionRead(CamelModel):
    id: uuid.UUID
    subject_id: str
    started_at: datetime
    duration_seconds: int
    bpm: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
