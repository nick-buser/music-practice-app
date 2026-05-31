"""A user-saved chord: a `ChordIdentity` (the JSON shape from the frontend) plus
a label. The identity is stored as a document, not exploded into columns — same
principle the frontend refactor settled on: persist the source, derive the rest.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OwnedMixin, PKMixin, SoftDeleteMixin, TimestampMixin

# JSONB on Postgres (indexable, queryable); plain JSON on SQLite for fast tests.
IdentityJSON = JSON().with_variant(JSONB(), "postgresql")


class SavedChord(PKMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "saved_chords"

    label: Mapped[str | None] = mapped_column(default=None)
    identity: Mapped[dict[str, Any]] = mapped_column(IdentityJSON, nullable=False)
