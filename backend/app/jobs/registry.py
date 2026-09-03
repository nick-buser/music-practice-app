"""The extractor registry: what a worker run actually executes.

Every extractor is a small, stateless object satisfying the `Extractor`
protocol below, registered under a bare name (`sha256-echo`, later PV3's
`midi-features`, ...) via `register()`. `ExtractionRun.extractor` already
carries that name — `app/jobs/worker.py` looks it up here at execute time
and never imports a concrete extractor module itself, so adding a new
extractor never touches the worker.

`PropertyOut`/`AssetOut` are the extractor-facing output contract —
deliberately *not* `app.schemas.provenance.PropertyIn` (the wire DTO for
`POST /v1/runs`'s completed-run body): an extractor runs inside the worker
process, never over HTTP, so there is no camelCase/pydantic concern here,
just plain data for the worker to turn into rows.

`ExtractorContext` is what `run(ctx)` actually sees: the run it is
producing for (read `run.input_sha256s`/`run.params` — the worker alone
ever writes `run.status`/timing, see `models/provenance.py`'s "immutable
except status/timing/error" rule) plus read access to input bytes via the
media store, by sha256. That's content-addressed
(`app.storage.content_key`), so it needs no DB lookup to find the bytes —
the same key any uploader (today: `IdeaAsset`) already wrote to.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Any, Protocol

from app.models.provenance import ExtractionRun
from app.storage import MediaStore, content_key


@dataclass(frozen=True)
class PropertyOut:
    """One derived fact an extractor hands back; the worker turns each into
    an `ExtractedProperty` row tied to the run that produced it.
    """

    kind: str
    payload: dict[str, Any]
    time_range: dict[str, Any] | None = None
    confidence: float | None = None


@dataclass(frozen=True)
class AssetOut:
    """A derived *asset* (bytes) an extractor hands back — e.g. a rendered
    preview or an extracted stem.

    Only wired end-to-end for `subject_kind == 'idea'` today:
    `app.models.idea.IdeaAsset` is the only table PV1/SB2 shipped that can
    hold a derived-asset row, so `app/jobs/worker.py`'s asset-writing path
    raises a clear `NotImplementedError` for any other subject kind rather
    than silently dropping the bytes or guessing at a schema that doesn't
    exist yet (`recording`'s asset table is RC1, not this ticket). No
    built-in extractor returns one yet — `sha256-echo` below only ever
    returns a `PropertyOut` — this type exists now purely so a later
    extractor doesn't need a worker.py change to start returning one.
    """

    role: str
    filename: str
    mime: str
    data: bytes


@dataclass(frozen=True)
class ExtractorContext:
    """What `Extractor.run` sees for one execution."""

    run: ExtractionRun
    store: MediaStore

    def open_input(self, sha256: str) -> AbstractContextManager[Iterator[bytes]]:
        """Stream one of `run.input_sha256s` by digest, in `MediaStore`'s
        own chunked form. Prefer this over `read_input` for anything but a
        small input — it never buffers the whole blob in memory.
        """
        return self.store.open_stream(content_key(sha256))

    def read_input(self, sha256: str) -> bytes:
        """Convenience for small inputs: `open_input` plus a full read."""
        with self.open_input(sha256) as chunks:
            return b"".join(chunks)


class Extractor(Protocol):
    """What `register()` accepts and `worker.run_once` executes.

    Deliberately a `Protocol`, not a base class extractors must inherit:
    every extractor here is a tiny, stateless value (see `Sha256Echo`
    below), and structural typing means one needs nothing but these two
    attributes and one method — no import of this module at all, if that
    ever mattered for a future extractor living in its own package
    (`app/jobs/extractors/`, PV3+).
    """

    name: str
    version: str

    def run(self, ctx: ExtractorContext) -> list[PropertyOut | AssetOut]: ...


_REGISTRY: dict[str, Extractor] = {}


def register[T: Extractor](extractor: T) -> T:
    """Registers `extractor` under `extractor.name` and returns it unchanged
    (so `register(Sha256Echo())` below both registers and, if ever wanted,
    still hands back a usable reference).

    Takes an already-built instance rather than a class: every extractor
    here is stateless, so there is nothing a class-decorator form would
    buy beyond assuming every future extractor has a no-arg constructor —
    an assumption this signature never has to make.

    Re-registering an already-used name is a programming error, not a
    silent overwrite: it would mean two extractor objects both claiming to
    be the producer named `ExtractionRun.extractor`, which the provenance
    contract (`app/provenance.py`) treats as one identity.
    """
    if extractor.name in _REGISTRY:
        raise ValueError(f"extractor {extractor.name!r} is already registered")
    _REGISTRY[extractor.name] = extractor
    return extractor


class UnknownExtractor(LookupError):
    """No extractor is registered under the requested name.

    Raised by `get_extractor` and caught the same as any other extractor
    failure by `worker.run_once` — a bad or misspelled `extractor` on an
    enqueued run ends that one run `failed` with a clear message, not a
    worker-loop crash that would starve every other queued run behind it.
    """


def get_extractor(name: str) -> Extractor:
    try:
        return _REGISTRY[name]
    except KeyError:
        raise UnknownExtractor(f"no extractor registered under name {name!r}") from None


class Sha256Echo:
    """The built-in reference extractor (`sha256-echo`): returns the run's
    own input hashes as a property. It proves the claim→execute→write path
    end to end with no real signal-processing dependency, and is what
    `tests/test_worker.py` exercises directly — real extractors (PV3's
    `midi-features`, ...) are the actual payload this worker exists to run.
    """

    name = "sha256-echo"
    version = "1.0.0"

    def run(self, ctx: ExtractorContext) -> list[PropertyOut | AssetOut]:
        return [
            PropertyOut(
                kind="sha256_echo",
                payload={"inputSha256s": sorted(ctx.run.input_sha256s)},
            )
        ]


register(Sha256Echo())
