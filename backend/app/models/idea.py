"""Ideas and the DAG between them — the object the sketchbook workstream is
about (docs/sketchbook.md). `Idea` is deliberately under-typed: capture
first, structure later. Only `status` is a real (small) enum because the
inbox is a product feature; `kinds`/`tags` stay free-vocabulary lists on
purpose — see the doc for why (a `THING-183` acquiring `type = [harmony,
transition]` later is normal, not a schema violation). Derived maturity
(idea / sketch / composition) is intentionally not stored anywhere here.

`status` and `kind` are plain `String` columns with `CheckConstraint`s
rather than SQLAlchemy `Enum` types, matching `app/models/provenance.py`:
nothing else in `app/models/` uses `Enum`, and a native Postgres enum would
need a `DROP TYPE` in `migrations/versions/0003_ideas.py`'s downgrade that a
CHECK constraint doesn't.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.links import IdeaLinkKind, IdeaStatus
from app.models.base import Base, OwnedMixin, PKMixin, SoftDeleteMixin, TimestampMixin

# JSONB on Postgres (indexable, queryable); plain JSON on SQLite for fast tests.
IdeaJSON = JSON().with_variant(JSONB(), "postgresql")


class Idea(PKMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "ideas"
    __table_args__ = (
        UniqueConstraint("user_id", "handle", name="uq_ideas_user_handle"),
        CheckConstraint("status IN ('inbox','active','shelved','done')", name="ck_ideas_status"),
    )

    # Minted as `max(handle) + 1` per user (app/repositories/ideas.py) — no
    # Postgres sequence backs it. The minting query does not filter
    # `deleted_at IS NULL`, so a soft-deleted idea's handle is never reused.
    # "#183" in prose refers to this, never to `id`.
    handle: Mapped[int] = mapped_column(index=True)
    title: Mapped[str | None] = mapped_column(default=None)
    body: Mapped[str] = mapped_column(default="")
    status: Mapped[IdeaStatus] = mapped_column(String, default="inbox", index=True)
    # Free vocabulary, not an enum — see the module docstring.
    kinds: Mapped[list[str]] = mapped_column(IdeaJSON, default=list)
    tags: Mapped[list[str]] = mapped_column(IdeaJSON, default=list)
    key: Mapped[str | None] = mapped_column(default=None)
    meter: Mapped[str | None] = mapped_column(default=None)
    bpm: Mapped[int | None] = mapped_column(default=None)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class IdeaLink(PKMixin, Base):
    """One edge in the idea DAG (docs/sketchbook.md's `idea_links` table).

    No `OwnedMixin`/`TimestampMixin` here, mirroring `ExtractedProperty`
    (app/models/provenance.py): ownership lives on `from_id`'s idea, not on
    this row. Hard-deleted (no `SoftDeleteMixin`) because the `mentions`
    kind is fully recomputed by delete-then-insert on every idea save
    (`app/repositories/ideas.py`) — a soft-deleted tombstone would just be
    noise the `(from_id, to_id, kind)` uniqueness still has to dodge.
    """

    __tablename__ = "idea_links"
    __table_args__ = (
        UniqueConstraint("from_id", "to_id", "kind", name="uq_idea_links_from_to_kind"),
        CheckConstraint(
            "kind IN ("
            "'derived_from','variant_of','resembles','might_fit_with','inspired_by',"
            "'incorporated_into','responds_to','mentions')",
            name="ck_idea_links_kind",
        ),
    )

    from_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), index=True, nullable=False
    )
    to_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[IdeaLinkKind] = mapped_column(String, index=True)
    note: Mapped[str | None] = mapped_column(default=None)
