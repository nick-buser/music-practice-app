"""Search-box query grammar for `GET /v1/ideas?q=` (docs/sketchbook.md's
"Search" seed, SB5). One free-text box has to double as a lightweight
filter language — `tag:piano kind:melody blue light` — without ever
punishing the user for typing something it doesn't recognise: a rejected
token would just make the search box untrustworthy, so `parse_query` never
raises and never silently drops input. Anything that isn't a clean
`prefix:value` match — an unknown prefix, a bare `:`, an empty value, or
(per the SB5 acceptance criterion) a `status:` value that isn't a real
`IdeaStatus` — simply stays part of the free text instead.

Pure and side-effect-free, like `app/links.py`'s `extract_handles`: turning
a query string into filter buckets never needs a DB session, so this stays
trivially unit-testable (`tests/test_search.py`) and importable from both
the SQLite and Postgres branches of `app/repositories/ideas.py::list_ideas`
with no I/O of its own. No SQLAlchemy import belongs in this module — the
one Postgres-only SQL fragment SB5 needs (the unmapped `search_tsv` column
expression) lives in `app/models/idea.py` instead, precisely so this file
can stay DB-less. See that module for why.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import get_args

from app.links import IdeaStatus

# Case-insensitive prefix, then everything up to end-of-token as the value.
# `.+` requires at least one character, so `tag:` (empty value) simply
# doesn't match and falls through to free text like any other token — no
# separate empty-value check needed.
_TOKEN_RE = re.compile(r"^(tag|kind|key|status):(.+)$", re.IGNORECASE)

# Mirrors `app/routers/provenance.py`'s `_COMPLETED_STATUSES` idiom: derive
# the valid-value set from the `Literal` itself rather than hand-copying it,
# so this can't drift from `app/links.py::IdeaStatus`.
_VALID_STATUSES: frozenset[str] = frozenset(get_args(IdeaStatus))


def _unquote(value: str) -> str:
    """Strip one layer of matching surrounding quotes so `tag:"east coast"`
    filters on `east coast`, not the literal `"east coast"` — a search box
    is exactly the place people reach for quotes out of habit.
    """
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    return value


@dataclass(frozen=True)
class ParsedQuery:
    """The four filter buckets `app/repositories/ideas.py::list_ideas`
    reads, plus whatever's left over as free text. Tuples (not sets) so
    repeated values keep their original order — irrelevant to correctness
    today, but cheaper to reason about than a set when someone's staring at
    a failing test.
    """

    tags: tuple[str, ...] = ()
    kinds: tuple[str, ...] = ()
    keys: tuple[str, ...] = ()
    statuses: tuple[str, ...] = ()
    text: str = ""


def parse_query(q: str | None) -> ParsedQuery:
    """Whitespace-split `q`; a token shaped like `prefix:value` (prefix one
    of tag/kind/key/status, case-insensitive, value stripped of a matching
    pair of quotes) joins that bucket, and everything else — including an
    unrecognised prefix like `composer:bach`, a bare `:`, an empty value
    (`tag:`), and a `status:` value that isn't a real `IdeaStatus`
    (`status:frobnicate`) — joins `text` instead, in original order,
    rejoined with single spaces regardless of the original whitespace.
    `None`/empty/whitespace-only `q` returns an all-empty `ParsedQuery`.
    """
    if not q:
        return ParsedQuery()

    tags: list[str] = []
    kinds: list[str] = []
    keys: list[str] = []
    statuses: list[str] = []
    text_words: list[str] = []

    for token in q.split():
        match = _TOKEN_RE.match(token)
        if match is None:
            text_words.append(token)
            continue
        prefix = match.group(1).lower()
        value = _unquote(match.group(2))
        if not value:
            text_words.append(token)  # e.g. `tag:""` unquotes to empty
            continue
        if prefix == "tag":
            tags.append(value)
        elif prefix == "kind":
            kinds.append(value)
        elif prefix == "key":
            keys.append(value)
        elif value.lower() in _VALID_STATUSES:
            statuses.append(value.lower())
        else:
            text_words.append(token)  # status:frobnicate — not a real IdeaStatus

    return ParsedQuery(
        tags=tuple(tags),
        kinds=tuple(kinds),
        keys=tuple(keys),
        statuses=tuple(statuses),
        text=" ".join(text_words),
    )
