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

from sqlalchemy import (
    JSON,
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    column,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.links import IdeaAssetRole, IdeaLinkKind, IdeaStatus
from app.models.base import Base, OwnedMixin, PKMixin, SoftDeleteMixin, TimestampMixin

# JSONB on Postgres (indexable, queryable); plain JSON on SQLite for fast tests.
IdeaJSON = JSON().with_variant(JSONB(), "postgresql")

# SB5 (docs/sketchbook.md's "Search" seed): a bare, unmapped expression for
# the generated `search_tsv` column that `migrations/versions/0007_ideas_
# search.py` adds — on Postgres only. Deliberately NOT a `mapped_column` on
# `Idea`: SQLAlchemy 2.0 has no per-dialect `Computed()`, so mapping it
# would force `Base.metadata.create_all()` (the SQLite test path) to either
# emit a `GENERATED ALWAYS AS` expression SQLite can't execute, or map a
# plain column that never exists there at all. A bare `column()` sidesteps
# both: it's just a name + type SQLAlchemy can build an expression against,
# with no `create_all()`/mapper involvement.
#
# Lives here rather than in `app/search.py` because that module's own
# docstring commits it to staying SQLAlchemy-free (pure, DB-less, trivially
# unit-testable) — this is the one place a Postgres-only SQL fragment can
# live without breaking that contract. Only the Postgres branch of
# `app/repositories/ideas.py::list_ideas` ever references it; the SQLite
# branch never touches it, matching the migration's own guard.
IDEA_SEARCH_TSV = column("search_tsv", TSVECTOR)


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


class IdeaAsset(PKMixin, TimestampMixin, SoftDeleteMixin, Base):
    """One attachment on an idea at a given revision — docs/sketchbook.md's
    "Attachments — raw is immortal, derived is recomputable".

    No `OwnedMixin`: ownership lives on `idea_id`'s idea, exactly as
    `IdeaLink`'s ownership lives on `from_id`'s idea (see that class's
    docstring above) — every route reaches an asset only after first
    loading its owner-scoped idea (`app/repositories/ideas.py`), so a
    duplicate `user_id` column here would be denormalised noise with
    nothing to check it against. Unlike `IdeaLink` it *does* carry
    `SoftDeleteMixin`: `DELETE /v1/ideas/{id}/assets/{asset_id}` retires
    the row but never the bytes it names — the object at `storage_key`
    stays in Garage forever (a janitor that reaps genuinely-unreferenced
    objects is explicitly future work per the doc, not this ticket's), so
    a soft-delete is the only kind of delete this table can have.
    """

    __tablename__ = "idea_assets"
    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_idea_assets_revision_positive"),
        CheckConstraint(
            "role IN ("
            "'melody','harmony','bass','drums','full','render','score','rpp',"
            "'reference','image','other')",
            name="ck_idea_assets_role",
        ),
    )

    idea_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # A linear per-idea sequence, not a global one — see the doc's
    # "Versioning" section. Minted by `app/repositories/ideas.py`
    # (idea's-current-max, or +1 for `new_revision`), never client-supplied.
    revision: Mapped[int] = mapped_column(default=1)
    # A real (small) enum, unlike `Idea.kinds`/`Idea.tags` — see
    # docs/sketchbook.md's `idea_assets` block for the exact vocabulary this
    # must stay byte-identical to. `String` + `CheckConstraint`, matching
    # `Idea.status`/`IdeaLink.kind` above and this module's docstring on why
    # (never a native SQLAlchemy `Enum`).
    role: Mapped[IdeaAssetRole] = mapped_column(String, index=True)
    filename: Mapped[str] = mapped_column(String)
    # Content-addressed — `app.storage.content_key(sha256)` — so identical
    # bytes reused across revisions or even across ideas share one object.
    storage_key: Mapped[str] = mapped_column(String, index=True)
    mime: Mapped[str] = mapped_column(String)
    bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String, index=True)
    # Set ⇒ derived by a named producer (the provenance spine reaches bytes,
    # not only jsonb properties — the doc's "Design decisions" list); unset
    # ⇒ raw, human-supplied, never regenerable. This table owns the FK to
    # `extraction_runs`: PV1 landed that table first, so per the grooming
    # doc's ownership rule ("whichever of SB2/PV1 lands second"), SB2's
    # migration (0004) is the one that adds it.
    run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("extraction_runs.id", ondelete="CASCADE"), index=True, default=None
    )
