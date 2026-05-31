"""Declarative base + the mixins every table leans on.

The mixin set is deliberate groundwork:
  * PKMixin       — UUID primary keys the *client* can mint (offline-friendly),
                    not server serials.
  * TimestampMixin / SoftDeleteMixin — `updated_at` + `deleted_at` give a future
                    sync engine (PowerSync/Electric) the columns it needs without
                    a re-architecture.
  * OwnedMixin    — every owned row carries `user_id` now, so flipping from the
                    single default user to real multi-tenancy is a query filter,
                    not a migration of the whole schema.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class PKMixin:
    # `default` lets the server mint one, but clients may supply their own UUID
    # (the basis for offline-created rows that sync up later).
    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class OwnedMixin:
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
