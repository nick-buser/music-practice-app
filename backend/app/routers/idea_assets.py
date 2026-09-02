"""The idea-attachment API: upload (streamed through `MediaStoreDep`),
revision-grouped listing, streaming download, and soft-delete. See
docs/sketchbook.md's "Attachments" section for the object this implements.

This is the first route in the app that accepts bytes rather than JSON, so
it is also the first to enforce `settings.media_max_upload_bytes` — see
`_CappedStream` below for how, and why that is not the same thing as
checking `Content-Length`.
"""

from __future__ import annotations

import uuid
from typing import Annotated, BinaryIO, cast

from fastapi import APIRouter, File, Form, Header, UploadFile, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.deps import CurrentUserDep, DbSession, MediaStoreDep
from app.errors import ProblemException, not_found
from app.links import IdeaAssetRole
from app.repositories import idea_assets as repo
from app.repositories import ideas as ideas_repo
from app.schemas.idea_asset import IdeaAssetRead, IdeaAssetRevisionGroup
from app.storage import stream_blob_response

router = APIRouter(prefix="/ideas", tags=["idea-assets"])


def _too_large(max_bytes: int) -> ProblemException:
    return ProblemException(
        status=413,
        title="Upload too large",
        detail=f"Upload exceeds the {max_bytes}-byte limit.",
    )


class _CappedStream:
    """A read-only, `BinaryIO`-shaped wrapper that aborts once more than
    `max_bytes` have been read from it.

    `MediaStore.put_stream` (`app/storage.py`) reads its input in fixed-size
    chunks and only *finalises* the object — `put_object` for
    `S3MediaStore`, registering the dict entry for `MemoryMediaStore` —
    after its whole read loop completes without error. Raising mid-`read()`
    here therefore means neither backend ever commits a byte of a
    rejected, oversize upload: `S3MediaStore` never reaches its
    `put_object` call (the exception unwinds out of the `with
    tempfile.SpooledTemporaryFile(...)` block first, which discards the
    partial spool on its own), and `MemoryMediaStore` never reaches the
    line that adds the object to its dict. A 413 therefore never leaves a
    partial object behind in either store — the property
    `tests/test_idea_assets.py` pins directly against `MemoryMediaStore`.

    Only `.read()` is ever called on this by either backend, so the `cast`
    to `BinaryIO` at the call site is safe on that basis — not because this
    class actually implements the full `BinaryIO` surface.
    """

    def __init__(self, fileobj: BinaryIO, max_bytes: int) -> None:
        self._fileobj = fileobj
        self._max_bytes = max_bytes
        self._seen = 0

    def read(self, size: int = -1) -> bytes:
        chunk = self._fileobj.read(size)
        self._seen += len(chunk)
        if self._seen > self._max_bytes:
            raise _too_large(self._max_bytes)
        return chunk


@router.post("/{idea_id}/assets", response_model=IdeaAssetRead, status_code=status.HTTP_201_CREATED)
def upload_asset(
    idea_id: uuid.UUID,
    db: DbSession,
    user: CurrentUserDep,
    store: MediaStoreDep,
    file: Annotated[UploadFile, File()],
    role: Annotated[IdeaAssetRole, Form()],
    new_revision: Annotated[bool, Form(alias="newRevision")] = False,
    # FastAPI lower-cases and normalises header names, so `content_length`
    # (default `convert_underscores=True`) binds to an incoming
    # `Content-Length` regardless of the client's own casing.
    content_length: Annotated[int | None, Header()] = None,
) -> IdeaAssetRead:
    # Cheap, best-effort first check: a client that honestly declares an
    # oversize `Content-Length` is rejected before this route does any
    # DB/storage work at all. This is *not* the authoritative cap — by the
    # time this function body runs, FastAPI has already resolved `file` as
    # a dependency, which means Starlette's multipart parser has already
    # read the entire body off the socket into `file`'s (disk-spooling)
    # temp file. Genuinely pre-empting that read would need an ASGI
    # middleware inspecting the header before routing/dependency
    # resolution — judged out of scope here: this app is single-tenant and
    # not adversarial (app/config.py), and an ingress-level body-size limit
    # is the right place to fully stop an oversize body from being
    # *received* at all. What this app owns, and what `_CappedStream`
    # below actually guarantees, is that an oversize body is never
    # *persisted* — not committed to Garage, and no DB row written for it —
    # regardless of what `Content-Length` claimed or omitted.
    max_bytes = settings.media_max_upload_bytes
    if content_length is not None and content_length > max_bytes:
        raise _too_large(max_bytes)

    idea = ideas_repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")

    capped = _CappedStream(file.file, max_bytes)
    mime = file.content_type or "application/octet-stream"
    blob = store.put_stream(cast(BinaryIO, capped), mime)

    asset = repo.create_asset(
        db,
        idea,
        role=role,
        filename=file.filename or "upload",
        blob=blob,
        new_revision=new_revision,
    )
    return IdeaAssetRead.model_validate(asset)


@router.get("/{idea_id}/assets", response_model=list[IdeaAssetRevisionGroup])
def list_assets(
    idea_id: uuid.UUID, db: DbSession, user: CurrentUserDep
) -> list[IdeaAssetRevisionGroup]:
    idea = ideas_repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")

    groups: dict[int, list[IdeaAssetRead]] = {}
    order: list[int] = []
    for asset in repo.list_assets(db, idea):
        if asset.revision not in groups:
            groups[asset.revision] = []
            order.append(asset.revision)
        groups[asset.revision].append(IdeaAssetRead.model_validate(asset))
    # `repo.list_assets` already orders by revision desc, so `order` is
    # already newest-first — no extra sort needed here.
    return [IdeaAssetRevisionGroup(revision=r, assets=groups[r]) for r in order]


@router.get("/{idea_id}/assets/{asset_id}/content")
def download_asset(
    idea_id: uuid.UUID,
    asset_id: uuid.UUID,
    db: DbSession,
    user: CurrentUserDep,
    store: MediaStoreDep,
) -> StreamingResponse:
    idea = ideas_repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")
    asset = repo.get_asset(db, idea, asset_id)
    if asset is None:
        raise not_found("Asset")
    stat = store.stat(asset.storage_key)
    if stat is None:
        # Should not happen — raw is immortal (docs/sketchbook.md) — but an
        # asset row naming bytes the store no longer has is still a 404 for
        # this specific piece of content, not a 500.
        raise not_found("Asset content")
    return stream_blob_response(store, asset.storage_key, asset.sha256, stat)


@router.delete("/{idea_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    idea_id: uuid.UUID, asset_id: uuid.UUID, db: DbSession, user: CurrentUserDep
) -> None:
    idea = ideas_repo.get_idea(db, user.id, idea_id)
    if idea is None:
        raise not_found("Idea")
    asset = repo.get_asset(db, idea, asset_id)
    if asset is None:
        raise not_found("Asset")
    repo.soft_delete_asset(db, asset)
