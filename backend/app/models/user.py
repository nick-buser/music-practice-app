"""The User table.

Single-tenant today: one seeded default user (see `app.seed`). But the table and
every `user_id` FK exist now, so enabling real auth/multi-tenancy later means
wiring `get_current_user` to a token instead of the default — no schema change.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, PKMixin, TimestampMixin

# Stable id for the single default user (single-tenant phase).
DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class User(PKMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str | None] = mapped_column(unique=True, default=None)
    display_name: Mapped[str] = mapped_column(default="Default User")
