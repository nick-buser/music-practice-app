"""Wire schemas for idea attachments — see docs/sketchbook.md's
"Attachments" section and `app/models/idea.py::IdeaAsset`.

There is deliberately no `IdeaAssetCreate`: `POST /v1/ideas/{id}/assets` is
`multipart/form-data` (a streamed file plus two form fields), not JSON, so
FastAPI's own `Form`/`File` parameters describe that request body
(`app/routers/idea_assets.py`) rather than a `CamelModel`.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from app.links import IdeaAssetRole
from app.schemas.base import CamelModel


class IdeaAssetRead(CamelModel):
    id: uuid.UUID
    idea_id: uuid.UUID
    revision: int
    role: IdeaAssetRole
    filename: str
    storage_key: str
    mime: str
    bytes: int
    sha256: str
    run_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class IdeaAssetRevisionGroup(CamelModel):
    """One revision's attachment set, newest revision first — see the doc:
    "'Save to Sketchbook' from REAPER writes revision n+1, and earlier
    revisions stay." Pre-grouped so the idea page can render "attachments
    by revision" in one pass, the same reasoning `IdeaLinkEdge`
    (`app/schemas/idea.py`) gives for carrying the *other* idea's identity
    rather than making the frontend re-derive a shape the backend already
    knows.
    """

    revision: int
    assets: list[IdeaAssetRead]
