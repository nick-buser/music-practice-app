"""A logged practice session — the time-series the tracker is built around."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OwnedMixin, PKMixin, SoftDeleteMixin, TimestampMixin


class PracticeSession(PKMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "practice_sessions"

    # The drill (possibly voiced, e.g. "c-maj7-chord~drop2") or piece practised.
    subject_id: Mapped[str] = mapped_column(index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int] = mapped_column(default=0)
    bpm: Mapped[int | None] = mapped_column(default=None)
    notes: Mapped[str | None] = mapped_column(default=None)
