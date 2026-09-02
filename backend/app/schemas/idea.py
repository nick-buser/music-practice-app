"""Wire schemas for the ideas API.

`IdeaLinkEdge` deliberately does not mirror the `idea_links` row shape: it
carries the *other* idea's `handle`/`title` (the doc's requirement — a link
badge needs to be renderable on its own, "#42 · variant_of · a jazzier
bridge", without a second round-trip), not `from_id`/`to_id`, which the
caller already knows one half of from the URL it just requested.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.links import IdeaLinkKind, IdeaStatus
from app.schemas.base import CamelModel


class IdeaCreate(CamelModel):
    # Clients may mint the id (offline-first), matching every other Create
    # schema in this app.
    id: uuid.UUID | None = None
    title: str | None = None
    # Inbox capture requires nothing at all — an empty body is a valid idea.
    body: str = ""
    status: IdeaStatus = "inbox"
    kinds: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    key: str | None = None
    meter: str | None = None
    bpm: int | None = Field(default=None, ge=1, le=400)
    # Defaults to "now" server-side (app/repositories/ideas.py) when unset —
    # accepting it lets an importer (REAPER's ideas-inbox sidecar, later)
    # backfill the real capture time instead of the import time.
    captured_at: datetime | None = None


class IdeaUpdate(CamelModel):
    title: str | None = None
    body: str | None = None
    status: IdeaStatus | None = None
    kinds: list[str] | None = None
    tags: list[str] | None = None
    key: str | None = None
    meter: str | None = None
    bpm: int | None = Field(default=None, ge=1, le=400)


class IdeaLinkCreate(CamelModel):
    to_id: uuid.UUID
    kind: IdeaLinkKind
    note: str | None = None


class IdeaLinkEdge(CamelModel):
    """One edge as seen from an idea's own page — see the module docstring
    for why this carries the *other* idea's identity, not `from_id`/`to_id`.
    """

    id: uuid.UUID
    kind: IdeaLinkKind
    note: str | None
    idea_id: uuid.UUID
    handle: int
    title: str | None


class IdeaSummary(CamelModel):
    """The list-view shape — no links, so `GET /v1/ideas` stays one query
    per page rather than N+1 (see `IdeaRead` for the single-idea shape that
    does carry them).
    """

    id: uuid.UUID
    handle: int
    title: str | None
    body: str
    status: IdeaStatus
    kinds: list[str]
    tags: list[str]
    key: str | None
    meter: str | None
    bpm: int | None
    captured_at: datetime
    created_at: datetime
    updated_at: datetime


class IdeaRead(IdeaSummary):
    links_in: list[IdeaLinkEdge]
    links_out: list[IdeaLinkEdge]
