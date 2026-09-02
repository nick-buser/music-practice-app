"""Wire schemas for the provenance API.

`RunCreate` covers both shapes `POST /v1/runs` accepts (see
docs/recordings-provenance.md): an **enqueue** body (`executor: 'worker'`)
and a **completed-run** body (`executor: 'client' | 'external'`, carrying
`status`/`properties`/`error`). They share every other field, and which of
`status`/`properties`/`error` are legal depends on `executor` — that's a
cross-field rule the router enforces (`app/routers/provenance.py`), not
something a schema alone can express cleanly, so this stays one flat model
rather than a discriminated union.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.provenance import CompletedRunStatus, Executor, RunStatus
from app.schemas.base import CamelModel

# `CamelModel`'s `to_camel` generator turns `input_sha256s` into
# `inputSha256S` (it treats the digit→letter transition in "256s" as a new
# word and capitalises it) — not the `inputSha256s` the wire contract and
# every client actually use (see docs/recordings-provenance.md). Pin the
# alias explicitly on every field of this name rather than relying on the
# generator.
_INPUT_SHA256S_ALIAS = "inputSha256s"


class PropertyIn(CamelModel):
    kind: str
    time_range: dict[str, Any] | None = None
    payload: dict[str, Any]
    confidence: float | None = None


class RunCreate(CamelModel):
    subject_kind: str
    subject_id: str
    extractor: str
    extractor_version: str
    model_ref: str | None = None
    executor: Executor
    params: dict[str, Any] = Field(default_factory=dict)
    input_sha256s: list[str] = Field(default_factory=list, alias=_INPUT_SHA256S_ALIAS)
    # Legal only when `executor` is 'client' | 'external'; ignored for a
    # 'worker' enqueue body regardless of what a client sends.
    status: CompletedRunStatus | None = None
    error: str | None = None
    properties: list[PropertyIn] = Field(default_factory=list[PropertyIn])


class ExtractionRunRead(CamelModel):
    id: uuid.UUID
    subject_kind: str
    subject_id: str
    input_sha256s: list[str] = Field(alias=_INPUT_SHA256S_ALIAS)
    extractor: str
    extractor_version: str
    model_ref: str | None
    executor: Executor
    params: dict[str, Any]
    params_hash: str
    status: RunStatus
    started_at: datetime | None
    finished_at: datetime | None
    error: str | None
    created_at: datetime
    updated_at: datetime


class ExtractedPropertyWithRun(CamelModel):
    """A property plus the run that produced it — the lineage badge every
    provenance read carries ("tempo curve — beat-tracker v0.3 · Jul 12 take").
    """

    id: uuid.UUID
    kind: str
    time_range: dict[str, Any] | None
    payload: dict[str, Any]
    confidence: float | None
    run: ExtractionRunRead
