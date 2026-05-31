"""CRUD for practice sessions."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.deps import CurrentUserDep, DbSession, PageParamsDep
from app.errors import not_found
from app.repositories import sessions as repo
from app.schemas.common import Page
from app.schemas.session import (
    PracticeSessionCreate,
    PracticeSessionRead,
    PracticeSessionUpdate,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=Page[PracticeSessionRead])
def list_sessions(
    db: DbSession, user: CurrentUserDep, page: PageParamsDep
) -> Page[PracticeSessionRead]:
    items, total = repo.list_sessions(db, user.id, page.limit, page.offset)
    return Page(
        items=[PracticeSessionRead.model_validate(s) for s in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.post("", response_model=PracticeSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    data: PracticeSessionCreate, db: DbSession, user: CurrentUserDep
) -> PracticeSessionRead:
    return PracticeSessionRead.model_validate(repo.create_session(db, user.id, data))


@router.get("/{session_id}", response_model=PracticeSessionRead)
def get_session(session_id: uuid.UUID, db: DbSession, user: CurrentUserDep) -> PracticeSessionRead:
    sess = repo.get_session(db, user.id, session_id)
    if sess is None:
        raise not_found("Session")
    return PracticeSessionRead.model_validate(sess)


@router.patch("/{session_id}", response_model=PracticeSessionRead)
def update_session(
    session_id: uuid.UUID,
    data: PracticeSessionUpdate,
    db: DbSession,
    user: CurrentUserDep,
) -> PracticeSessionRead:
    sess = repo.get_session(db, user.id, session_id)
    if sess is None:
        raise not_found("Session")
    return PracticeSessionRead.model_validate(repo.update_session(db, sess, data))


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: uuid.UUID, db: DbSession, user: CurrentUserDep) -> None:
    sess = repo.get_session(db, user.id, session_id)
    if sess is None:
        raise not_found("Session")
    repo.soft_delete_session(db, sess)
