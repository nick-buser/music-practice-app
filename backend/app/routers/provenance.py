"""The provenance API: `POST /v1/runs` (enqueue or completed-run — see
docs/recordings-provenance.md), plus reads keyed by run id or by subject.

Runs are immutable once written, so there is deliberately no PATCH here: a
correction is a new run, never an edit of this one.
"""

from __future__ import annotations

import uuid
from typing import get_args

from fastapi import APIRouter, Response, status

from app.config import settings
from app.deps import CurrentUserDep, DbSession, PageParamsDep
from app.errors import ProblemException, not_found
from app.provenance import CompletedRunStatus, compose_subject, latest_properties
from app.repositories import provenance as repo
from app.schemas.common import Page
from app.schemas.provenance import ExtractedPropertyWithRun, ExtractionRunRead, RunCreate

router = APIRouter(tags=["provenance"])

# `RunCreate.status` is already typed `CompletedRunStatus | None`, but a
# 'worker' enqueue body legitimately has no status at all — this is the set
# a completed-run body's status must land in.
_COMPLETED_STATUSES = frozenset(get_args(CompletedRunStatus))


@router.post("/runs", response_model=ExtractionRunRead)
def create_run(
    data: RunCreate, response: Response, db: DbSession, user: CurrentUserDep
) -> ExtractionRunRead:
    if data.executor == "worker":
        run, created = repo.get_or_create_queued_run(db, user.id, data)
    else:
        # The allow-list is config (`settings.client_extractors`), not
        # something the wire schema can express — a worker-only extractor
        # name posted as 'client'/'external' is a 422, not silently queued
        # or silently accepted.
        if data.extractor not in settings.client_extractors:
            raise ProblemException(
                status=422,
                title="Extractor not allow-listed",
                detail=(
                    f"'{data.extractor}' is not in the client/external extractor "
                    "allow-list (settings.client_extractors); only a worker "
                    "extractor may be posted this way."
                ),
            )
        if data.status not in _COMPLETED_STATUSES:
            raise ProblemException(
                status=422,
                title="Invalid completed-run body",
                detail=(
                    "status must be 'succeeded' or 'failed' when executor is "
                    "'client' or 'external'."
                ),
            )
        # Narrowed by the check above; `data.status` is `CompletedRunStatus`
        # at this point, pyright just can't see it through the `in` check.
        completed_status: CompletedRunStatus = data.status  # type: ignore[assignment]
        run, created = repo.get_or_create_completed_run(
            db, user.id, data, completed_status, data.properties, data.error
        )
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return ExtractionRunRead.model_validate(run)


@router.get("/runs/{run_id}", response_model=ExtractionRunRead)
def get_run(run_id: uuid.UUID, db: DbSession, user: CurrentUserDep) -> ExtractionRunRead:
    run = repo.get_run(db, user.id, run_id)
    if run is None:
        raise not_found("Run")
    return ExtractionRunRead.model_validate(run)


@router.get("/subjects/{kind}/{subject_id}/runs", response_model=Page[ExtractionRunRead])
def list_subject_runs(
    kind: str, subject_id: str, db: DbSession, user: CurrentUserDep, page: PageParamsDep
) -> Page[ExtractionRunRead]:
    subject = compose_subject(kind, subject_id)
    items, total = repo.list_runs_for_subject(db, user.id, subject, page.limit, page.offset)
    return Page(
        items=[ExtractionRunRead.model_validate(r) for r in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get(
    "/subjects/{kind}/{subject_id}/properties", response_model=list[ExtractedPropertyWithRun]
)
def list_subject_properties(
    kind: str, subject_id: str, db: DbSession, user: CurrentUserDep
) -> list[ExtractedPropertyWithRun]:
    subject = compose_subject(kind, subject_id)
    pairs = latest_properties(db, user.id, subject)
    return [
        ExtractedPropertyWithRun(
            id=prop.id,
            kind=prop.kind,
            time_range=prop.time_range,
            payload=prop.payload,
            confidence=prop.confidence,
            run=ExtractionRunRead.model_validate(run),
        )
        for prop, run in pairs
    ]
