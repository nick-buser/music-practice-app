"""The provenance contract: "every derived datum names its producer."

`app/models/provenance.py` carries the two tables; this module carries the
domain logic that is not plain CRUD — the canonical hash that makes an
extraction idempotent, the subject-id composition rule, and the "newest
wins" read that lets a UI show current properties without ever deleting a
superseded run. See docs/recordings-provenance.md for the full design.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, Literal, NamedTuple

from sqlalchemy import select
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from app.models.provenance import ExtractedProperty, ExtractionRun

Executor = Literal["worker", "client", "external"]
RunStatus = Literal["queued", "running", "succeeded", "failed"]
# The subset of `RunStatus` a completed-run POST body may declare — `queued`
# and `running` only ever come from the (not-yet-built, PV2) worker path.
CompletedRunStatus = Literal["succeeded", "failed"]

# Subject kinds that store `kind:<uuid>` (idea/SB4, score/SC4, exercise/SR7,
# recording/RC1 — none of which exist yet at PV1's time, but the string form
# is fixed now so later tickets need no PV1 follow-up). Every other kind is a
# bundled id (piece/scale today, per app/src/data/subject.ts) and stores the
# bare id unprefixed, exactly as `practice_sessions.subject_id` always has.
_UUID_BACKED_SUBJECT_KINDS = frozenset({"idea", "score", "exercise", "recording"})


class Subject(NamedTuple):
    """A subject in the house form: `kind` denormalised alongside the full
    `id` string (`kind:<uuid>` or a bare bundled id) that is actually stored
    in `subject_id` columns.
    """

    kind: str
    id: str


def compose_subject(kind: str, bare_id: str) -> Subject:
    """`/v1/subjects/{kind}/{id}/...` routes receive a bare id; this is the
    one place that composes the stored `subject_id` string from it, so every
    route agrees on the rule instead of each re-deriving it.
    """
    stored_id = f"{kind}:{bare_id}" if kind in _UUID_BACKED_SUBJECT_KINDS else bare_id
    return Subject(kind=kind, id=stored_id)


def fold_input_sha256s(params: dict[str, Any], input_sha256s: Sequence[str]) -> dict[str, Any]:
    """The one place `inputSha256s` gets folded into a run's params. After
    this, `canonical_params_hash` sees the inputs as part of the hashed
    content, so two different inputs of the same subject can never collide
    on the identity unique index — and clients never send this key
    themselves, so they can't spoof it.
    """
    return {**params, "inputSha256s": sorted(input_sha256s)}


def canonical_params_hash(params: dict[str, Any]) -> str:
    """sha256 of `params` as sorted-key, separator-compact JSON.

    Call this only after `fold_input_sha256s` has folded the sorted input
    hashes in (see `app.repositories.provenance`) — this function doesn't
    know about `input_sha256s` itself, it just guarantees that key order (and
    only key order — a changed value still changes the hash) never affects
    the result.
    """
    encoded = json.dumps(params, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def latest_properties(
    db: Session, user_id: uuid.UUID, subject: Subject
) -> list[tuple[ExtractedProperty, ExtractionRun]]:
    """The newest succeeded run's property per `(extractor, kind)` for one
    subject — the "current" read a UI shows. Superseded runs are left alone
    in `runs` for comparison/time-travel; supersession is this read, never a
    delete.

    Owner-scoped like every other read in this codebase (`OwnedMixin` exists
    precisely so this filter is here, ready for real multi-tenancy, even
    though today's single-tenant deploy means it's always the default user).
    """
    from app.models.provenance import ExtractedProperty, ExtractionRun

    rows = db.execute(
        select(ExtractedProperty, ExtractionRun)
        .join(ExtractionRun, ExtractedProperty.run_id == ExtractionRun.id)
        .where(
            ExtractionRun.user_id == user_id,
            ExtractionRun.subject_kind == subject.kind,
            ExtractionRun.subject_id == subject.id,
            ExtractionRun.status == "succeeded",
        )
    ).all()

    newest: dict[tuple[str, str], tuple[ExtractedProperty, ExtractionRun]] = {}
    for prop, run in rows:
        key = (run.extractor, prop.kind)
        current = newest.get(key)
        if current is None or _run_is_newer(run, current[1]):
            newest[key] = (prop, run)
    return list(newest.values())


def _run_is_newer(a: ExtractionRun, b: ExtractionRun) -> bool:
    # `finished_at` is set once, at completion, by application code
    # (`datetime.now(UTC)`, microsecond resolution) — not `created_at`'s
    # `server_default=func.now()`, which on SQLite is `CURRENT_TIMESTAMP`
    # (whole-second resolution, easily tied by two runs completed in the
    # same test). Fall back to `created_at` only for the enqueued/unfinished
    # case, which `latest_properties` never actually sees (it filters on
    # `status == 'succeeded'`, and a succeeded run always has `finished_at`).
    a_at, b_at = a.finished_at, b.finished_at
    if a_at is None or b_at is None:
        return bool(a.created_at > b.created_at)
    return bool(a_at > b_at)
