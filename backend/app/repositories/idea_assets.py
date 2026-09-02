"""Data access for idea attachments — owner-scoped indirectly through the
parent `Idea` (see `IdeaAsset`'s docstring), plus revision minting.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.idea import Idea, IdeaAsset
from app.storage import StoredBlob


def _current_max_revision(db: Session, idea_id: uuid.UUID) -> int:
    """`max(revision)` for this idea, or 0 if it has none yet.

    Deliberately does **not** filter `deleted_at IS NULL`, mirroring
    `app/repositories/ideas.py::_next_handle`: a soft-deleted asset still
    occupies its revision number, so deleting the newest attachment in a
    revision can never make a later plain upload land back on that same
    (now partially-emptied) revision.
    """
    current_max = db.scalar(
        select(func.max(IdeaAsset.revision)).where(IdeaAsset.idea_id == idea_id)
    )
    return current_max or 0


def create_asset(
    db: Session,
    idea: Idea,
    *,
    role: str,
    filename: str,
    blob: StoredBlob,
    new_revision: bool,
    run_id: uuid.UUID | None = None,
) -> IdeaAsset:
    """Attaches `blob` to `idea`'s current revision, or the next one when
    `new_revision` — "Default revision = the idea's current max (1 if
    none); new_revision=true bumps it" (SB2).

    `idea` must already be a persisted row — every caller loads it via
    `app.repositories.ideas.get_idea` before reaching here, never
    constructs one in this same transaction — so, unlike
    `app.repositories.ideas.create_idea`'s LOAD-BEARING flush before
    `_sync_mentions`, there is no cross-insert ordering hazard for
    `idea_id` here: the parent row this FK points at is already committed.
    `run_id` (when set) is likewise expected to name an already-existing
    `ExtractionRun` for the same reason.
    """
    current_max = _current_max_revision(db, idea.id)
    revision = current_max + 1 if new_revision else (current_max or 1)
    asset = IdeaAsset(
        idea_id=idea.id,
        revision=revision,
        role=role,
        filename=filename,
        storage_key=blob.storage_key,
        mime=blob.mime,
        bytes=blob.size_bytes,
        sha256=blob.sha256,
        run_id=run_id,
    )
    db.add(asset)
    db.flush()
    db.refresh(asset)
    return asset


def list_assets(db: Session, idea: Idea) -> list[IdeaAsset]:
    """Newest revision first, then insertion order within a revision —
    exactly the order `app/routers/idea_assets.py` groups by revision in.
    """
    return list(
        db.scalars(
            select(IdeaAsset)
            .where(IdeaAsset.idea_id == idea.id, IdeaAsset.deleted_at.is_(None))
            .order_by(IdeaAsset.revision.desc(), IdeaAsset.created_at)
        )
    )


def get_asset(db: Session, idea: Idea, asset_id: uuid.UUID) -> IdeaAsset | None:
    return db.scalar(
        select(IdeaAsset).where(
            IdeaAsset.id == asset_id,
            IdeaAsset.idea_id == idea.id,
            IdeaAsset.deleted_at.is_(None),
        )
    )


def soft_delete_asset(db: Session, asset: IdeaAsset) -> None:
    # Soft-delete only — never touches the store. Raw is immortal (see
    # `IdeaAsset`'s docstring): the bytes at `asset.storage_key` stay in
    # Garage forever; only this row's visibility goes away. A janitor that
    # reaps genuinely-unreferenced objects is future work, not this one.
    asset.deleted_at = datetime.now(UTC)
    db.flush()
