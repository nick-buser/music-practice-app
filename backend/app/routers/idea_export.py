"""`GET /v1/ideas/{idea_id}/export`: the ten-year-guarantee bundle, streamed
as a zip. See `app/export/bundle.py` for the manifest/sinks this wraps, and
docs/sketchbook.md's "Portability without a third store".

Split out from `app/routers/ideas.py` the same way `idea_assets.py` is —
one file per idea sub-resource that has its own reason to change. Owner-
scoped exactly like every other idea route: a missing or foreign idea is a
404 through `not_found`, not a 403 (this app never leaks existence — see
`app/routers/idea_assets.py` for the identical pattern).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.deps import CurrentUserDep, DbSession, MediaStoreDep
from app.errors import not_found
from app.export.bundle import build_zip, export_idea
from app.repositories import ideas as ideas_repo

router = APIRouter(prefix="/ideas", tags=["idea-export"])


# See `app/routers/idea_assets.py`'s comment on the same pattern: FastAPI
# infers a JSON 200 from a bare `-> StreamingResponse` return annotation,
# which would mistype every generated client. The explicit `responses=`
# entry documents the real `application/zip` media type instead.
@router.get(
    "/{idea_id}/export",
    response_class=StreamingResponse,
    responses={200: {"content": {"application/zip": {}}}},
)
def export_idea_bundle(
    idea_id: uuid.UUID, db: DbSession, user: CurrentUserDep, store: MediaStoreDep
) -> StreamingResponse:
    idea = ideas_repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")

    # Built fully in memory before the response starts — "make sure the
    # archive is actually complete and valid before the response starts"
    # (the ticket's own words). `build_zip`'s own docstring has the reason
    # this is fine: idea bundles are small.
    archive = build_zip(export_idea(db, store, idea))
    filename = f"idea-{idea.handle}.zip"
    return StreamingResponse(
        iter([archive]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
