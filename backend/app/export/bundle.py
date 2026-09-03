"""One idea's export bundle — the "ten-year guarantee"
(docs/sketchbook.md's "Portability without a third store"): "Postgres is
the index, Garage is the bytes, and portability is an export... one write
path, no sync engine."

`export_idea` turns an `Idea` into a flat stream of `(path, bytes)`
entries: `manifest.yaml` (`app/export/manifest.py`), `notes.md` (the body,
plain text), then one `assets/<revision>/<filename>` entry per visible
attachment. `write_directory` and `build_zip` are the two sinks named in
the ticket's scope line ("directory and zip sinks") — both are thin
consumers of that one iterator and nothing else, matching the doc:
"Exporting to a directory, a tarball, or a Gitea repo are three sinks over
the same function." `app/routers/idea_export.py` is the third sink: it
just calls `build_zip` and wraps the result in a `StreamingResponse`.

`import_bundle` is the inverse and the harder half: it recreates rows in a
(possibly totally different) database by going through the same
repository functions production CRUD uses
(`app/repositories/ideas.py`, `app/repositories/idea_assets.py`) — never
hand-inserting a row those modules already know how to build — so handle
minting and the `mentions`-edge recompute can never drift into a second
implementation that disagrees with the first.
"""

from __future__ import annotations

import io
import uuid
import zipfile
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, cast, get_args

import yaml
from sqlalchemy.orm import Session

from app.export.manifest import (
    MANIFEST_SCHEMA_VERSION,
    IdeaManifest,
    ManifestAsset,
    ManifestLink,
)
from app.links import IdeaLinkKind
from app.models.idea import Idea, IdeaAsset
from app.repositories import idea_assets as assets_repo
from app.repositories import ideas as ideas_repo
from app.repositories import provenance as provenance_repo
from app.storage import MediaStore

MANIFEST_PATH = "manifest.yaml"
NOTES_PATH = "notes.md"

# Every `IdeaLinkKind` except `mentions` — see `ManifestLink`'s docstring
# (`app/export/manifest.py`) for why `mentions` is never one of these.
# Built from the shared `Literal` rather than a second hand-copied
# vocabulary list, matching the `get_args(...)` pattern already used by
# `app/search.py` and `app/routers/provenance.py`.
_HUMAN_LINK_KINDS: frozenset[str] = frozenset(k for k in get_args(IdeaLinkKind) if k != "mentions")


class BundleError(Exception):
    """Base for every `import_bundle`/sink failure that means "this bundle
    is malformed or hostile", never a normal control-flow signal.
    """


class UnsafeBundlePathError(BundleError):
    """An entry path would escape the destination it is written into or
    read from — a leading `/`, an absolute path, or any `..` segment.

    Raised, never silently sanitised: "a bundle is a thing people will
    eventually receive from someone else" (the ticket's own words), and a
    path traversal attempt in one is a hostile or corrupt bundle, not a
    typo worth guessing past. `write_directory`, `build_zip`, and
    `import_bundle` all call `_safe_relpath` on every entry they touch, so
    all three raise this the same way.
    """


class UnknownSchemaVersionError(BundleError):
    """`manifest.yaml`'s `schema_version` is not one this build of
    `import_bundle` knows how to read. Deliberately its own exception
    (not a generic `ValueError` pydantic would raise on a bad manifest
    shape) — a version mismatch is a *format* problem the caller should
    be able to catch and report specifically, not a validation detail.
    """


def _safe_relpath(path: str) -> PurePosixPath:
    if path.startswith("/"):
        raise UnsafeBundlePathError(path)
    pure = PurePosixPath(path)
    if pure.is_absolute() or not pure.parts or ".." in pure.parts:
        raise UnsafeBundlePathError(path)
    return pure


def _asset_path(revision: int, filename: str) -> str:
    return f"assets/{revision}/{filename}"


def _read_all(store: MediaStore, storage_key: str) -> bytes:
    """Joins one asset's bytes out of the store in `_CHUNK_SIZE` pieces
    (`app/storage.py`) rather than assuming the backend hands back one
    blob — the "stream out of the store" half of the ticket's instruction.
    A whole *file* still has to exist in memory as one unit to become one
    `(path, bytes)` entry (zip/directory writers both need that), but the
    thing this avoids is holding every asset of a multi-asset bundle in
    memory at once: `export_idea` calls this once per asset, in the same
    generator step that yields it.
    """
    with store.open_stream(storage_key) as chunks:
        return b"".join(chunks)


def export_idea(db: Session, store: MediaStore, idea: Idea) -> Iterator[tuple[str, bytes]]:
    """Yields `manifest.yaml`, `notes.md`, then one
    `assets/<revision>/<filename>` entry per attachment currently visible
    on `idea` (soft-deleted assets are excluded — `list_assets` already
    does that). Only `idea`'s *outgoing* human-authored links are
    exported: ownership of an `IdeaLink` lives on `from_id`'s idea
    (`app/models/idea.py::IdeaLink`'s own docstring), so an idea's bundle
    carries the edges it is the source of, not the ones pointing at it.
    """
    _, links_out = ideas_repo.get_idea_links(db, idea)
    manifest_links = [
        ManifestLink(kind=link.kind, to_handle=other.handle, note=link.note)
        for link, other in links_out
        if link.kind in _HUMAN_LINK_KINDS
    ]

    # Ascending by revision (then insertion order within a revision) for a
    # bundle a human reads top-to-bottom — `list_assets` itself returns
    # newest-first, which is right for an API response but backwards for a
    # ten-year-later reader of `manifest.yaml`.
    assets = sorted(assets_repo.list_assets(db, idea), key=lambda a: (a.revision, a.created_at))

    manifest_assets: list[ManifestAsset] = []
    for asset in assets:
        producer: str | None = None
        if asset.run_id is not None:
            run = provenance_repo.get_run(db, idea.user_id, asset.run_id)
            # A `run_id` naming a run this same export can't see (wrong
            # user, or a row that's somehow gone) is not this ticket's
            # problem to repair — fall back to `None` rather than raise, so
            # one orphaned FK never blocks exporting the rest of the idea.
            producer = run.extractor if run is not None else None
        manifest_assets.append(
            ManifestAsset(
                role=asset.role,
                filename=asset.filename,
                mime=asset.mime,
                sha256=asset.sha256,
                revision=asset.revision,
                producer=producer,
            )
        )

    manifest = IdeaManifest(
        id=idea.id,
        handle=idea.handle,
        title=idea.title,
        status=idea.status,
        kinds=list(idea.kinds),
        tags=list(idea.tags),
        key=idea.key,
        meter=idea.meter,
        bpm=idea.bpm,
        captured_at=idea.captured_at,
        links=manifest_links,
        assets=manifest_assets,
        # Always empty — see app/export/manifest.py's "Mandated scope
        # decision". Not a query that returned nothing: deliberately never
        # queried.
        properties=[],
    )
    # `mode="json"` first: PyYAML's `SafeDumper` has no representer for
    # `uuid.UUID` or `datetime` (it would raise `RepresenterError`), so the
    # manifest has to already be plain str/int/float/bool/None/list/dict
    # before `safe_dump` sees it. `sort_keys=False` keeps `schema_version`
    # first and the rest in the doc's own declared order, not alphabetical;
    # `allow_unicode=True` so an accented title survives as text, not a
    # `\uXXXX` escape.
    manifest_yaml = yaml.safe_dump(
        manifest.model_dump(mode="json"), sort_keys=False, allow_unicode=True
    )
    yield MANIFEST_PATH, manifest_yaml.encode("utf-8")
    yield NOTES_PATH, idea.body.encode("utf-8")

    for asset in assets:
        path = _asset_path(asset.revision, asset.filename)
        yield path, _read_all(store, asset.storage_key)


def write_directory(entries: Iterable[tuple[str, bytes]], root: Path) -> None:
    """Writes `entries` under `root`, creating parent directories as
    needed. `root` itself is the caller's trusted destination; every entry
    *path* is not (`_safe_relpath`) — see `UnsafeBundlePathError`.
    """
    for path, data in entries:
        safe_path = _safe_relpath(path)
        dest = root / safe_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)


def build_zip(entries: Iterable[tuple[str, bytes]]) -> bytes:
    """Builds one complete zip archive in memory from `entries` and
    returns its bytes. Whole-in-memory is the ticket's own call here
    ("idea bundles are small (a handful of assets)") and is what lets
    `app/routers/idea_export.py` guarantee the archive is fully valid
    *before* the HTTP response starts, rather than streaming a
    `zipfile.ZipFile` write loop that could die halfway through a response
    already sent as 200.
    """
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path, data in entries:
            safe_path = _safe_relpath(path)
            zf.writestr(safe_path.as_posix(), data)
    return buffer.getvalue()


def _parse_manifest(data: bytes) -> IdeaManifest:
    # `yaml.safe_load` ships no type stubs (`reportMissingTypeStubs = false`
    # in pyproject.toml, same accommodation `app/storage.py` makes for
    # boto3). An `isinstance(raw, dict)` check alone still narrows to
    # `dict[Unknown, Unknown]` (there is nothing typed to narrow *to*), so
    # the explicit `cast` below is what actually stops that Unknown-ness
    # from leaking into `.get(...)`'s inferred type.
    raw: Any = yaml.safe_load(data.decode("utf-8"))
    manifest_dict = cast(dict[str, Any], raw) if isinstance(raw, dict) else None
    version: Any = manifest_dict.get("schema_version") if manifest_dict is not None else None
    if version != MANIFEST_SCHEMA_VERSION:
        raise UnknownSchemaVersionError(
            f"manifest.yaml has schema_version={version!r}; this build of "
            f"import_bundle only understands {MANIFEST_SCHEMA_VERSION}."
        )
    return IdeaManifest.model_validate(raw)


@dataclass(frozen=True)
class ImportResult:
    """What `import_bundle` hands back — enough for a caller (and
    `tests/test_export.py`) to know exactly what survived verbatim and
    what didn't have to.
    """

    idea: Idea
    # `True` when `manifest.handle` was already taken in the target
    # database and `_next_handle` had to mint a fresh one instead.
    handle_reminted: bool
    assets: list[IdeaAsset]
    # Manifest links whose `to_handle` does not name a live idea in the
    # target database — dropped silently, matching `_sync_mentions`'s own
    # "unknown handle ⇒ no edge, no error" rule.
    dropped_links: list[ManifestLink]


def import_bundle(
    db: Session, store: MediaStore, entries: Iterable[tuple[str, bytes]], user_id: uuid.UUID
) -> ImportResult:
    """Recreates one idea (and its links/assets) from `entries` — the same
    `(path, bytes)` shape `export_idea` yields, from any source (a
    directory walk, an opened zip, another call to `export_idea`).

    `user_id` names the target database's owner. This is one parameter
    more than the ticket's own summary signature
    (`import_bundle(db, store, entries)`) — but every owned row in this
    app is scoped by an explicit `user_id` argument at the repository
    layer (`app/repositories/ideas.py`, `app/repositories/idea_assets.py`
    — never a hardcoded default, see `app/deps.py`'s "no endpoint or model
    changes when [multi-tenant] day comes" reasoning), and `import_bundle`
    has no HTTP request to pull a `CurrentUser` from, so it has to accept
    the same thing every repository function already does explicitly.

    Mints a fresh `Idea.id` always (`IdeaManifest.id` is provenance-only —
    see that field's docstring); keeps `manifest.handle` verbatim when
    `handle_taken` says it's free in the target database, otherwise
    reminds via `ideas_repo._next_handle` — the exact function
    `ideas_repo.create_idea` itself uses, not a re-implementation of its
    minting rule. `ideas_repo._sync_mentions` recomputes `mentions` from
    the imported body against the *target* database's live handles —
    never carried from the manifest, because the manifest never has any
    (`ManifestLink`'s docstring).
    """
    manifest: IdeaManifest | None = None
    notes = ""
    asset_bytes: dict[str, bytes] = {}
    for path, data in entries:
        safe_path = _safe_relpath(path).as_posix()
        if safe_path == MANIFEST_PATH:
            manifest = _parse_manifest(data)
        elif safe_path == NOTES_PATH:
            notes = data.decode("utf-8")
        else:
            asset_bytes[safe_path] = data
    if manifest is None:
        raise BundleError("bundle has no manifest.yaml entry")

    if ideas_repo.handle_taken(db, user_id, manifest.handle):
        # `_next_handle` is the exact function `create_idea` mints new
        # handles with — reused directly rather than re-derived, per this
        # function's own docstring. Private by convention (leading
        # underscore, not enforced), matching the precedent already set by
        # `tests/test_idea_assets.py::_CappedStream` and
        # `tests/test_ideas.py`'s own `repo._next_handle` reach-in.
        handle = ideas_repo._next_handle(db, user_id)  # pyright: ignore[reportPrivateUsage]
        handle_reminted = True
    else:
        handle = manifest.handle
        handle_reminted = False

    idea = Idea(
        user_id=user_id,
        handle=handle,
        title=manifest.title,
        body=notes,
        status=manifest.status,
        kinds=list(manifest.kinds),
        tags=list(manifest.tags),
        key=manifest.key,
        meter=manifest.meter,
        bpm=manifest.bpm,
        captured_at=manifest.captured_at,
    )
    db.add(idea)
    # LOAD-BEARING, mirroring `ideas_repo.create_idea`'s own comment on this
    # exact hazard: `idea.id` must be populated before `_sync_mentions` (or
    # `add_link` below) inserts any `IdeaLink` naming it as `from_id` — no
    # `relationship()` exists anywhere in `app/models/` to order those
    # inserts against this one otherwise.
    db.flush()
    db.refresh(idea)
    ideas_repo._sync_mentions(db, idea)  # pyright: ignore[reportPrivateUsage]

    dropped_links: list[ManifestLink] = []
    for link in manifest.links:
        target = ideas_repo.get_idea_by_handle(db, user_id, link.to_handle)
        if target is None:
            dropped_links.append(link)
            continue
        ideas_repo.add_link(db, idea, target, link.kind, link.note)

    # Sorted (stably) by revision so `create_asset`'s own current-max
    # incrementing (`app/repositories/idea_assets.py`) replays the same
    # revision numbers the export saw, regardless of what order this
    # particular bundle's assets list happens to be in. Note this can't
    # perfectly reproduce a *gap* in the original revision numbering (e.g.
    # every asset of revision 2 was later soft-deleted, so the export only
    # ever saw 1 and 3): `create_asset` always assigns current-max+1, so
    # imported revisions are always contiguous even when the source
    # idea's weren't. Not a promise this ticket makes — docs/sketchbook.md
    # promises linear order and content, never that revision *numbers*
    # survive a gap.
    imported_assets: list[IdeaAsset] = []
    prev_revision: int | None = None
    for manifest_asset in sorted(manifest.assets, key=lambda a: a.revision):
        path = _asset_path(manifest_asset.revision, manifest_asset.filename)
        data = asset_bytes.get(path)
        if data is None:
            raise BundleError(f"manifest references {path!r} but the bundle has no such entry")
        blob = store.put_stream(io.BytesIO(data), manifest_asset.mime)
        if blob.sha256 != manifest_asset.sha256:
            # The one internal-consistency check a bundle can be held to:
            # the bytes actually shipped alongside the manifest must hash
            # to what the manifest claims for them.
            raise BundleError(
                f"{path!r} hashes to {blob.sha256}, manifest says {manifest_asset.sha256}"
            )
        new_revision = prev_revision is not None and manifest_asset.revision != prev_revision
        imported_assets.append(
            assets_repo.create_asset(
                db,
                idea,
                role=manifest_asset.role,
                filename=manifest_asset.filename,
                blob=blob,
                new_revision=new_revision,
                # Provenance-only in the manifest — see
                # `ManifestAsset.producer`'s docstring. No `ExtractionRun`
                # row is recreated here, so there is nothing a real
                # `run_id` could point at in the target database.
                run_id=None,
            )
        )
        prev_revision = manifest_asset.revision

    return ImportResult(
        idea=idea,
        handle_reminted=handle_reminted,
        assets=imported_assets,
        dropped_links=dropped_links,
    )
