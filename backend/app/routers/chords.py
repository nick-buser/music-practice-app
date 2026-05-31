"""CRUD for saved chords (`ChordIdentity` documents)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.deps import CurrentUserDep, DbSession, PageParamsDep
from app.errors import not_found
from app.repositories import chords as repo
from app.schemas.chord import SavedChordCreate, SavedChordRead, SavedChordUpdate
from app.schemas.common import Page

router = APIRouter(prefix="/chords", tags=["chords"])


@router.get("", response_model=Page[SavedChordRead])
def list_chords(db: DbSession, user: CurrentUserDep, page: PageParamsDep) -> Page[SavedChordRead]:
    items, total = repo.list_chords(db, user.id, page.limit, page.offset)
    return Page(
        items=[SavedChordRead.model_validate(c) for c in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.post("", response_model=SavedChordRead, status_code=status.HTTP_201_CREATED)
def create_chord(data: SavedChordCreate, db: DbSession, user: CurrentUserDep) -> SavedChordRead:
    return SavedChordRead.model_validate(repo.create_chord(db, user.id, data))


@router.get("/{chord_id}", response_model=SavedChordRead)
def get_chord(chord_id: uuid.UUID, db: DbSession, user: CurrentUserDep) -> SavedChordRead:
    chord = repo.get_chord(db, user.id, chord_id)
    if chord is None:
        raise not_found("Chord")
    return SavedChordRead.model_validate(chord)


@router.patch("/{chord_id}", response_model=SavedChordRead)
def update_chord(
    chord_id: uuid.UUID, data: SavedChordUpdate, db: DbSession, user: CurrentUserDep
) -> SavedChordRead:
    chord = repo.get_chord(db, user.id, chord_id)
    if chord is None:
        raise not_found("Chord")
    return SavedChordRead.model_validate(repo.update_chord(db, chord, data))


@router.delete("/{chord_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chord(chord_id: uuid.UUID, db: DbSession, user: CurrentUserDep) -> None:
    chord = repo.get_chord(db, user.id, chord_id)
    if chord is None:
        raise not_found("Chord")
    repo.soft_delete_chord(db, chord)
