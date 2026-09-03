"""The export bundle manifest — docs/sketchbook.md's "Portability without a
third store": "Postgres is the index, Garage is the bytes, and portability
is an export... The manifest schema is defined up front and guarded by a
round-trip test."

`IdeaManifest` is a **file-format** schema for `manifest.yaml`, not a wire
schema: unlike everything in `app/schemas/`, it does not inherit
`CamelModel` (`app/schemas/base.py`) and carries no camelCase aliases. Its
field names are deliberately snake_case, matching the database column
names `docs/sketchbook.md` already documents — this is a thing a human (or
a future importer that is not this codebase) reads off disk in ten years,
so it reads like the data model, not like a JS client's conventions.

`schema_version` is first and mandatory: `import_bundle`
(`app/export/bundle.py`) checks it before validating anything else in the
document, and refuses any value it does not recognise.

**Mandated scope decision (SB6):** `properties` is always `[]` from
`export_idea` even though PV1's `extraction_runs`/`extracted_properties`
tables (and the properties this idea may actually have) already exist —
wiring real lineage into the export is out of scope for this ticket. The
shape below is fixed now specifically so that later ticket does not have
to bump `schema_version` to add it. Do not "fix" this without reading that
ticket's acceptance criteria first.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.links import IdeaAssetRole, IdeaLinkKind, IdeaStatus

MANIFEST_SCHEMA_VERSION = 1


class ManifestLink(BaseModel):
    """One human-authored `idea_links` edge, addressed by the *other*
    idea's **handle** — never its id. A bundle has to survive re-import
    into a database where every uuid is different; `handle` is the one
    identifier docs/sketchbook.md guarantees is stable prose-visible
    identity ("#183" always means `handle`), so it is the only thing a
    cross-database link can be addressed by.

    Only the seven human-authored `IdeaLinkKind` values ever appear here —
    never `mentions`. `_sync_mentions` (`app/repositories/ideas.py`) fully
    recomputes that kind by delete-then-insert from the body on every
    save, so exporting it would round-trip a value the importer would
    immediately discard and recompute anyway — or worse, could resurrect
    an edge the imported body no longer justifies (the body itself might
    have been hand-edited between export and import). `export_idea`
    filters `mentions` out before this model is ever built.
    """

    kind: IdeaLinkKind
    to_handle: int
    note: str | None = None


class ManifestAsset(BaseModel):
    """One `idea_assets` row, addressed by content rather than by id.

    `sha256` is what `import_bundle` re-puts through the target
    `MediaStore` — content-addressing means a re-put of bytes already
    present there collapses to a no-op (`app/storage.py`'s module
    docstring), so re-importing a bundle twice, or importing two bundles
    that happen to share an asset, never duplicates storage.

    `mime` is not one of the fields the ticket's scope line names
    (`role/filename/sha256/revision/producer`), but `IdeaAsset.mime` is a
    required, non-derivable column — unlike `bytes` (recomputed from the
    re-put) and `storage_key` (a pure function of `sha256`), there is no
    way to reconstruct it from the file's bytes alone without a sniffing
    step this app has never implemented. It has to travel in the
    manifest for `import_bundle` to be able to call
    `app.repositories.idea_assets.create_asset` at all, so it is carried
    here right next to the filename it describes.

    `producer` mirrors what `IdeaAsset.run_id` *means* (see that column's
    docstring in `app/models/idea.py`), not the run's id itself: `null`
    for raw, human-supplied bytes that are never regenerable, or the
    extractor's name for bytes a named producer derived. It is
    provenance-only, exactly like `IdeaManifest.id` below — `import_bundle`
    never recreates an `ExtractionRun` row (that is real provenance data,
    out of scope here per this module's "Mandated scope decision"), so
    every imported asset's `run_id` is `None` regardless of what its
    manifest `producer` says.
    """

    role: IdeaAssetRole
    filename: str
    mime: str
    sha256: str
    revision: int
    producer: str | None = None


class ManifestProperty(BaseModel):
    """One extracted property's lineage, modelled after
    `app/models/provenance.py`: `kind`/`time_range`/`payload`/`confidence`
    are `ExtractedProperty`'s own columns; `extractor`/`extractor_version`
    are the two `ExtractionRun` fields that say what asserted the fact.
    Deliberately excludes the run's id (meaningless across a re-import,
    exactly like `IdeaManifest.id` and `ManifestAsset.producer`) and every
    other `ExtractionRun` bookkeeping column (`status`, timestamps,
    `params`) that lineage display doesn't need.

    Always an empty list on every `IdeaManifest` this ticket produces —
    see the module docstring's "Mandated scope decision". The shape exists
    now so a later ticket that populates it does not have to change
    `schema_version`.
    """

    kind: str
    time_range: dict[str, object] | None = None
    payload: dict[str, object]
    confidence: float | None = None
    extractor: str
    extractor_version: str


class IdeaManifest(BaseModel):
    """`manifest.yaml`'s exact shape — see the module docstring for why
    this is snake_case and not a `CamelModel`.

    `id` is carried for **provenance only** — "this idea's id in the
    database that exported it" — and is never trusted by `import_bundle`:
    every import mints a fresh uuid, exactly like every other
    client-mintable-but-server-authoritative id in this app
    (`app/models/base.py::PKMixin`'s docstring). `handle` is the field
    that actually round-trips: kept verbatim in the target database when
    free, reminted via the same `_next_handle` path production uses
    otherwise (`app/export/bundle.py`).

    `body` (the markdown notes) deliberately is **not** a field here — it
    travels as the separate `notes.md` entry
    (docs/sketchbook.md's `export/ideas/0183/` layout), plain text with no
    front-matter, so a bundle's prose stays readable and diffable on its
    own rather than buried inside a YAML string.
    """

    schema_version: int = MANIFEST_SCHEMA_VERSION
    id: uuid.UUID
    handle: int
    title: str | None
    status: IdeaStatus
    kinds: list[str]
    tags: list[str]
    key: str | None
    meter: str | None
    bpm: int | None
    captured_at: datetime
    links: list[ManifestLink]
    assets: list[ManifestAsset]
    properties: list[ManifestProperty]
