from __future__ import annotations

import uuid
from datetime import datetime

from app.schemas.base import CamelModel
from app.schemas.chord_identity import ChordIdentity


class SavedChordCreate(CamelModel):
    # Clients may mint the id (offline-first); the server fills one in otherwise.
    id: uuid.UUID | None = None
    label: str | None = None
    identity: ChordIdentity


class SavedChordUpdate(CamelModel):
    label: str | None = None
    identity: ChordIdentity | None = None


class SavedChordRead(CamelModel):
    id: uuid.UUID
    label: str | None
    identity: ChordIdentity
    created_at: datetime
    updated_at: datetime
