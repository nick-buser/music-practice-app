"""Data access for saved chords. Every query is scoped to the owner and skips
soft-deleted rows — the two filters that make tenancy and undo cheap later.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.chord import SavedChord
from app.schemas.chord import SavedChordCreate, SavedChordUpdate


def list_chords(
    db: Session, user_id: uuid.UUID, limit: int, offset: int
) -> tuple[list[SavedChord], int]:
    where = (SavedChord.user_id == user_id, SavedChord.deleted_at.is_(None))
    total = db.scalar(select(func.count(SavedChord.id)).where(*where)) or 0
    rows = db.scalars(
        select(SavedChord)
        .where(*where)
        .order_by(SavedChord.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total


def get_chord(db: Session, user_id: uuid.UUID, chord_id: uuid.UUID) -> SavedChord | None:
    return db.scalar(
        select(SavedChord).where(
            SavedChord.id == chord_id,
            SavedChord.user_id == user_id,
            SavedChord.deleted_at.is_(None),
        )
    )


def create_chord(db: Session, user_id: uuid.UUID, data: SavedChordCreate) -> SavedChord:
    chord = SavedChord(
        user_id=user_id,
        label=data.label,
        identity=data.identity.model_dump(by_alias=True),
    )
    if data.id is not None:
        chord.id = data.id
    db.add(chord)
    db.flush()
    db.refresh(chord)
    return chord


def update_chord(db: Session, chord: SavedChord, data: SavedChordUpdate) -> SavedChord:
    if data.label is not None:
        chord.label = data.label
    if data.identity is not None:
        chord.identity = data.identity.model_dump(by_alias=True)
    db.flush()
    db.refresh(chord)
    return chord


def soft_delete_chord(db: Session, chord: SavedChord) -> None:
    chord.deleted_at = datetime.now(UTC)
    db.flush()
