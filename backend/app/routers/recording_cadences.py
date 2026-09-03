"""The recording-cadence API — RC3, "record this weekly". An upsert `PUT`
keyed on subject plus an owner-scoped list; see
`app/models/recording.py`'s `RecordingCadence` docstring for the
NULL-means-"off" convention and why there is deliberately no DELETE here.

Path segments are `{subject_kind}/{subject_id}` (snake_case), matching every
other subject-keyed path in this app (`/subjects/{kind}/{subject_id}/runs`
in `app/routers/provenance.py`) — `CamelModel`'s alias generator only
touches JSON body/query fields, never path segments, so there is no
existing camelCase-path precedent to match instead.
"""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.deps import CurrentUserDep, DbSession
from app.repositories import recording_cadences as repo
from app.schemas.recording import RecordingCadenceRead, RecordingCadenceUpdate

router = APIRouter(prefix="/recording-cadences", tags=["recording-cadences"])


@router.get("", response_model=list[RecordingCadenceRead])
def list_recording_cadences(db: DbSession, user: CurrentUserDep) -> list[RecordingCadenceRead]:
    cadences = repo.list_cadences(db, user.id)
    return [RecordingCadenceRead.model_validate(c) for c in cadences]


@router.put("/{subject_kind}/{subject_id}", response_model=RecordingCadenceRead)
def put_recording_cadence(
    subject_kind: str,
    subject_id: str,
    data: RecordingCadenceUpdate,
    response: Response,
    db: DbSession,
    user: CurrentUserDep,
) -> RecordingCadenceRead:
    # Upsert, not create: a second `PUT` for this subject updates the same
    # row in place (RC3 acceptance criterion 2) — 201 only the first time,
    # 200 on every later call, mirroring `app/routers/provenance.py`'s
    # `create_run`'s created-vs-idempotent status split.
    cadence, created = repo.upsert_cadence(
        db, user.id, subject_kind, subject_id, data.interval_days
    )
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return RecordingCadenceRead.model_validate(cadence)
