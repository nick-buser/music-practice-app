"""CRUD for ideas plus their links — see docs/sketchbook.md for the object
this implements. `mentions` edges are entirely derived (app/links.py,
app/repositories/ideas.py) and never created or deleted through the
`/links` endpoints below; those are for the human-authored kinds.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Query, status
from sqlalchemy import Row

from app.deps import CurrentUserDep, DbSession, PageParamsDep
from app.errors import ProblemException, not_found
from app.links import IdeaStatus
from app.models.idea import Idea, IdeaLink
from app.repositories import ideas as repo
from app.schemas.common import Page
from app.schemas.idea import (
    IdeaCreate,
    IdeaLinkCreate,
    IdeaLinkEdge,
    IdeaRead,
    IdeaSummary,
    IdeaUpdate,
)

router = APIRouter(prefix="/ideas", tags=["ideas"])


def _link_edge(link: IdeaLink, other: Idea) -> IdeaLinkEdge:
    return IdeaLinkEdge(
        id=link.id,
        kind=link.kind,
        note=link.note,
        idea_id=other.id,
        handle=other.handle,
        title=other.title,
    )


def _to_read(
    idea: Idea,
    links_in: Sequence[Row[tuple[IdeaLink, Idea]]],
    links_out: Sequence[Row[tuple[IdeaLink, Idea]]],
) -> IdeaRead:
    return IdeaRead(
        id=idea.id,
        handle=idea.handle,
        title=idea.title,
        body=idea.body,
        status=idea.status,
        kinds=idea.kinds,
        tags=idea.tags,
        key=idea.key,
        meter=idea.meter,
        bpm=idea.bpm,
        captured_at=idea.captured_at,
        created_at=idea.created_at,
        updated_at=idea.updated_at,
        links_in=[_link_edge(link, other) for link, other in links_in],
        links_out=[_link_edge(link, other) for link, other in links_out],
    )


@router.get("", response_model=Page[IdeaSummary])
def list_ideas(
    db: DbSession,
    user: CurrentUserDep,
    page: PageParamsDep,
    status_filter: Annotated[IdeaStatus | None, Query(alias="status")] = None,
    kind: Annotated[str | None, Query()] = None,
    tag: Annotated[str | None, Query()] = None,
) -> Page[IdeaSummary]:
    items, total = repo.list_ideas(db, user.id, page.limit, page.offset, status_filter, kind, tag)
    return Page(
        items=[IdeaSummary.model_validate(i) for i in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.post("", response_model=IdeaRead, status_code=status.HTTP_201_CREATED)
def create_idea(data: IdeaCreate, db: DbSession, user: CurrentUserDep) -> IdeaRead:
    idea = repo.create_idea(db, user.id, data)
    links_in, links_out = repo.get_idea_links(db, idea)
    return _to_read(idea, links_in, links_out)


@router.get("/{idea_id}", response_model=IdeaRead)
def get_idea(idea_id: uuid.UUID, db: DbSession, user: CurrentUserDep) -> IdeaRead:
    idea = repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")
    links_in, links_out = repo.get_idea_links(db, idea)
    return _to_read(idea, links_in, links_out)


@router.patch("/{idea_id}", response_model=IdeaRead)
def update_idea(
    idea_id: uuid.UUID, data: IdeaUpdate, db: DbSession, user: CurrentUserDep
) -> IdeaRead:
    idea = repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")
    idea = repo.update_idea(db, idea, data)
    links_in, links_out = repo.get_idea_links(db, idea)
    return _to_read(idea, links_in, links_out)


@router.delete("/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_idea(idea_id: uuid.UUID, db: DbSession, user: CurrentUserDep) -> None:
    idea = repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")
    repo.soft_delete_idea(db, idea)


@router.post("/{idea_id}/links", response_model=IdeaLinkEdge, status_code=status.HTTP_201_CREATED)
def create_link(
    idea_id: uuid.UUID, data: IdeaLinkCreate, db: DbSession, user: CurrentUserDep
) -> IdeaLinkEdge:
    idea = repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")
    target = repo.get_idea(db, user.id, data.to_id)
    if target is None:
        raise not_found("Idea")
    if target.id == idea.id:
        raise ProblemException(status=422, title="An idea cannot link to itself")
    if repo.find_link(db, idea.id, target.id, data.kind) is not None:
        raise ProblemException(
            status=409,
            title="Link already exists",
            detail=f"A '{data.kind}' link from this idea to that one already exists.",
        )
    link = repo.add_link(db, idea, target, data.kind, data.note)
    return _link_edge(link, target)


@router.delete("/{idea_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_link(
    idea_id: uuid.UUID, link_id: uuid.UUID, db: DbSession, user: CurrentUserDep
) -> None:
    idea = repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")
    link = repo.get_link(db, idea.id, link_id)
    if link is None:
        raise not_found("Link")
    repo.delete_link(db, link)
