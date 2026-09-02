"""`[[#n]]` link extraction: the only mechanism that turns an idea's body
text into `mentions` edges (docs/sketchbook.md). Pure and side-effect-free
by design — turning text into candidate handles never needs a DB session,
so this stays trivially unit-testable and is reusable from the repository
layer (`app/repositories/ideas.py`) with no I/O of its own.

Also carries the three small vocabularies `Idea`/`IdeaLink`/`IdeaAsset`
enforce with a `CheckConstraint` rather than a SQLAlchemy `Enum`
(`app/models/idea.py`) — model and schema both import them from here,
exactly as `app/models/provenance.py` and `app/schemas/provenance.py` both
import `Executor`/`RunStatus` from `app/provenance.py`. Schemas never
import from `app/models/` in this codebase, so a shared non-model module is
where a type used by both has to live.
"""

from __future__ import annotations

import re
from typing import Literal

IdeaStatus = Literal["inbox", "active", "shelved", "done"]

# docs/sketchbook.md's `idea_links` vocabulary. `mentions` is the one kind
# this module derives itself (below); every other kind is a human-authored
# edge created through `POST /v1/ideas/{id}/links`.
IdeaLinkKind = Literal[
    "derived_from",
    "variant_of",
    "resembles",
    "might_fit_with",
    "inspired_by",
    "incorporated_into",
    "responds_to",
    "mentions",
]

# docs/sketchbook.md's "Attachments" section, the `idea_assets` block's
# `role:` line, verbatim: `role: melody|harmony|bass|drums|full|render|
# score|rpp|reference|image|other`. `render`/`score` are reserved for
# machine-produced and non-substrate (PDF scan, manuscript photo) bytes
# respectively — see that doc's F1-amendment paragraph on `role: score`.
IdeaAssetRole = Literal[
    "melody",
    "harmony",
    "bass",
    "drums",
    "full",
    "render",
    "score",
    "rpp",
    "reference",
    "image",
    "other",
]

# Literal double brackets, a `#`, one or more digits, literal double
# brackets. Anything else — `[[#]]`, an unterminated `[[#12`, brackets with
# no `#` — just doesn't match; there is no "malformed link" error, only "no
# link here" (`extract_handles` returns the empty set).
_HANDLE_RE = re.compile(r"\[\[#(\d+)\]\]")

# The largest value a Postgres `integer` column can hold — what `Idea.handle`
# is (app/models/idea.py). A `[[#<huge number>]]` past this can never be a
# real handle (handles are minted from 1 upward), so it's dropped here
# rather than risk it reaching a `WHERE handle = :h` query as a literal a
# 4-byte integer column can't represent.
_MAX_HANDLE = 2_147_483_647


def extract_handles(body: str) -> set[int]:
    """Every handle referenced via `[[#n]]` in `body`, deduplicated.

    `[[#0]]` parses fine — 0 is a syntactically valid match — but can never
    resolve to a real idea, since minting starts at 1; it is simply one more
    "unknown handle" for the caller to drop, with no special-casing needed
    here. Nested brackets (`[[#1[[#2]]]]`) resolve to whichever innermost
    span is itself well-formed (`{2}` for that example) — regex matching is
    left-to-right and non-overlapping, so the malformed outer wrapper is
    never itself a candidate.
    """
    return {h for m in _HANDLE_RE.findall(body) if (h := int(m)) <= _MAX_HANDLE}
