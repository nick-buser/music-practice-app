"""Data access for ideas and their links — owner-scoped like every other
repository in this app, plus handle minting and the `mentions`-edge
recompute that make `[[#n]]` links free (docs/sketchbook.md).
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import Row, delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.links import extract_handles
from app.models.idea import Idea, IdeaLink
from app.schemas.idea import IdeaCreate, IdeaUpdate

# Bounded so a pathological run of concurrent creates fails loudly (a 500,
# surfaced by app/errors.py's catch-all) instead of looping forever — see
# `_next_handle`'s docstring for why the retry exists at all.
_MAX_HANDLE_MINT_ATTEMPTS = 5

_MENTIONS_KIND = "mentions"


def _next_handle(db: Session, user_id: uuid.UUID) -> int:
    """`max(handle) + 1` for this user. No Postgres sequence backs handles
    (docs/sketchbook.md), so this is the exact minting path production
    uses — the SQLite test suite exercises it directly, not a stand-in.

    Deliberately does **not** filter `deleted_at IS NULL`: a soft-deleted
    idea's handle must never be reused, so a deleted row still counts
    toward the max (explicit acceptance criterion).
    """
    current_max = db.scalar(select(func.max(Idea.handle)).where(Idea.user_id == user_id))
    return (current_max or 0) + 1


def _sync_mentions(db: Session, idea: Idea) -> None:
    """Recompute `idea`'s outgoing `mentions` edges from its current body —
    delete every stale `mentions` edge from this idea, then insert one per
    handle its body still references (docs/sketchbook.md: "recomputed on
    every save"). Cheaper to recompute the whole set than to diff it, and
    it makes "remove `[[#1]]` from the body" and "the edge disappears" the
    same code path as "add it" and "the edge appears".

    `idea.id` must already exist in the database before this runs (see the
    load-bearing flush in `create_idea`) — every `IdeaLink` added here
    carries `from_id=idea.id` as a bare FK column, and nothing else in
    `app/models/` orders this insert against `idea`'s own.

    Unknown handles (no matching idea, or the idea's own handle, or a
    soft-deleted idea) are dropped silently — no error, no edge — per the
    doc; that includes `[[#0]]`, which `extract_handles` happily parses but
    which can never resolve to a real idea since minting starts at 1.
    """
    db.execute(delete(IdeaLink).where(IdeaLink.from_id == idea.id, IdeaLink.kind == _MENTIONS_KIND))
    handles = extract_handles(idea.body)
    if not handles:
        return
    targets = db.scalars(
        select(Idea).where(
            Idea.user_id == idea.user_id,
            Idea.handle.in_(handles),
            Idea.deleted_at.is_(None),
            Idea.id != idea.id,
        )
    )
    for target in targets:
        db.add(IdeaLink(from_id=idea.id, to_id=target.id, kind=_MENTIONS_KIND))
    db.flush()


def list_ideas(
    db: Session,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
    status: str | None,
    kind: str | None,
    tag: str | None,
) -> tuple[list[Idea], int]:
    """`status` narrows in SQL; `kind`/`tag` narrow in Python afterward.

    `kinds`/`tags` are JSON list columns, and SQLite and Postgres have no
    portable containment operator SQLAlchemy can compile for both (JSONB
    `@>` is Postgres-only) — fine at this app's single-tenant scale, and
    full-text/filter search is its own later ticket
    (docs/sketchbook.md's "Search" seed), not this one's job to build.
    """
    where = [Idea.user_id == user_id, Idea.deleted_at.is_(None)]
    if status is not None:
        where.append(Idea.status == status)
    rows = list(db.scalars(select(Idea).where(*where).order_by(Idea.captured_at.desc())))
    if kind is not None:
        rows = [r for r in rows if kind in r.kinds]
    if tag is not None:
        rows = [r for r in rows if tag in r.tags]
    total = len(rows)
    return rows[offset : offset + limit], total


def get_idea(db: Session, user_id: uuid.UUID, idea_id: uuid.UUID) -> Idea | None:
    return db.scalar(
        select(Idea).where(Idea.id == idea_id, Idea.user_id == user_id, Idea.deleted_at.is_(None))
    )


def create_idea(db: Session, user_id: uuid.UUID, data: IdeaCreate) -> Idea:
    for _attempt in range(_MAX_HANDLE_MINT_ATTEMPTS):
        idea = Idea(
            user_id=user_id,
            handle=_next_handle(db, user_id),
            title=data.title,
            body=data.body,
            status=data.status,
            kinds=list(data.kinds),
            tags=list(data.tags),
            key=data.key,
            meter=data.meter,
            bpm=data.bpm,
            captured_at=data.captured_at or datetime.now(UTC),
        )
        if data.id is not None:
            idea.id = data.id
        db.add(idea)
        try:
            db.flush()
        except IntegrityError:
            # No Postgres sequence backs `handle` — two concurrent creates
            # can both read the same `max(handle)` and race to insert it,
            # tripping `uq_ideas_user_handle`. Roll back this attempt (safe:
            # `create_idea` is always the first write of its request, so
            # there is nothing else pending in the session to lose) and
            # remint against the now-updated max.
            db.rollback()
            continue
        db.refresh(idea)
        # LOAD-BEARING: `idea` must be an inserted row (id populated, flush
        # above already done) before `_sync_mentions` adds any `IdeaLink`
        # referencing it — there is no `relationship()` between Idea and
        # IdeaLink (see app/models/base.py's OwnedMixin docstring), so
        # nothing else in the unit of work orders that insert against this
        # one. See the longer version of this comment in
        # app/repositories/provenance.py::get_or_create_completed_run.
        _sync_mentions(db, idea)
        return idea
    raise RuntimeError(
        f"Could not mint a unique idea handle for user {user_id} after "
        f"{_MAX_HANDLE_MINT_ATTEMPTS} attempts (concurrent creates racing "
        "on the same max(handle)+1)."
    )


def update_idea(db: Session, idea: Idea, data: IdeaUpdate) -> Idea:
    if data.title is not None:
        idea.title = data.title
    if data.body is not None:
        idea.body = data.body
    if data.status is not None:
        idea.status = data.status
    if data.kinds is not None:
        idea.kinds = list(data.kinds)
    if data.tags is not None:
        idea.tags = list(data.tags)
    if data.key is not None:
        idea.key = data.key
    if data.meter is not None:
        idea.meter = data.meter
    if data.bpm is not None:
        idea.bpm = data.bpm
    db.flush()
    db.refresh(idea)
    # `idea` already exists in the DB (it was loaded, not just constructed),
    # so unlike `create_idea` there's no cross-insert ordering concern here —
    # recomputed on every save regardless of whether `body` actually changed.
    _sync_mentions(db, idea)
    return idea


def soft_delete_idea(db: Session, idea: Idea) -> None:
    idea.deleted_at = datetime.now(UTC)
    db.flush()


def get_idea_links(
    db: Session, idea: Idea
) -> tuple[Sequence[Row[tuple[IdeaLink, Idea]]], Sequence[Row[tuple[IdeaLink, Idea]]]]:
    """`(links_in, links_out)`, each row paired with the *other* idea in the
    edge — a plain join, not a `relationship()` (see app/models/base.py's
    OwnedMixin docstring for why there isn't one), so callers get both the
    edge and the idea it points at in one query per direction.
    """
    links_in = db.execute(
        select(IdeaLink, Idea)
        .join(Idea, IdeaLink.from_id == Idea.id)
        .where(IdeaLink.to_id == idea.id)
        .order_by(IdeaLink.kind, Idea.handle)
    ).all()
    links_out = db.execute(
        select(IdeaLink, Idea)
        .join(Idea, IdeaLink.to_id == Idea.id)
        .where(IdeaLink.from_id == idea.id)
        .order_by(IdeaLink.kind, Idea.handle)
    ).all()
    return links_in, links_out


def find_link(db: Session, from_id: uuid.UUID, to_id: uuid.UUID, kind: str) -> IdeaLink | None:
    return db.scalar(
        select(IdeaLink).where(
            IdeaLink.from_id == from_id, IdeaLink.to_id == to_id, IdeaLink.kind == kind
        )
    )


def add_link(db: Session, idea: Idea, target: Idea, kind: str, note: str | None) -> IdeaLink:
    link = IdeaLink(from_id=idea.id, to_id=target.id, kind=kind, note=note)
    db.add(link)
    db.flush()
    db.refresh(link)
    return link


def get_link(db: Session, idea_id: uuid.UUID, link_id: uuid.UUID) -> IdeaLink | None:
    return db.scalar(select(IdeaLink).where(IdeaLink.id == link_id, IdeaLink.from_id == idea_id))


def delete_link(db: Session, link: IdeaLink) -> None:
    db.delete(link)
    db.flush()
