"""Data access for practice sessions — owner-scoped, soft-delete aware."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.session import PracticeSession
from app.schemas.session import PracticeSessionCreate, PracticeSessionUpdate


def list_sessions(
    db: Session, user_id: uuid.UUID, limit: int, offset: int
) -> tuple[list[PracticeSession], int]:
    where = (PracticeSession.user_id == user_id, PracticeSession.deleted_at.is_(None))
    total = db.scalar(select(func.count(PracticeSession.id)).where(*where)) or 0
    rows = db.scalars(
        select(PracticeSession)
        .where(*where)
        .order_by(PracticeSession.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total


def get_session(db: Session, user_id: uuid.UUID, session_id: uuid.UUID) -> PracticeSession | None:
    return db.scalar(
        select(PracticeSession).where(
            PracticeSession.id == session_id,
            PracticeSession.user_id == user_id,
            PracticeSession.deleted_at.is_(None),
        )
    )


def create_session(db: Session, user_id: uuid.UUID, data: PracticeSessionCreate) -> PracticeSession:
    sess = PracticeSession(
        user_id=user_id,
        subject_id=data.subject_id,
        started_at=data.started_at,
        duration_seconds=data.duration_seconds,
        bpm=data.bpm,
        notes=data.notes,
    )
    if data.id is not None:
        sess.id = data.id
    db.add(sess)
    db.flush()
    db.refresh(sess)
    return sess


def update_session(
    db: Session, sess: PracticeSession, data: PracticeSessionUpdate
) -> PracticeSession:
    if data.duration_seconds is not None:
        sess.duration_seconds = data.duration_seconds
    if data.bpm is not None:
        sess.bpm = data.bpm
    if data.notes is not None:
        sess.notes = data.notes
    db.flush()
    db.refresh(sess)
    return sess


def soft_delete_session(db: Session, sess: PracticeSession) -> None:
    sess.deleted_at = datetime.now(UTC)
    db.flush()
