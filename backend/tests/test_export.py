"""The export bundle: manifest round-trip, both sinks, and the zip route.
See `app/export/manifest.py`, `app/export/bundle.py`,
`app/routers/idea_export.py`, and docs/sketchbook.md's "Portability
without a third store" — this is the ten-year guarantee the doc promises,
proved by round-tripping real rows through a completely separate database
and a completely separate `MemoryMediaStore`.

`_fresh_database` builds a *second*, wholly independent SQLite engine —
not just a wiped shared one — because the acceptance criterion says
"import into a fresh database" and the shared `app.db.engine` this file's
other tests use (via `SessionLocal`) is one process-wide in-memory
database (`StaticPool`) that every test file's `client` fixture merely
wipes and reseeds between tests, never actually replaces.
"""

from __future__ import annotations

import io
import uuid
import zipfile
from collections.abc import Generator, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import SessionLocal, engine
from app.deps import get_media_store
from app.export.bundle import (
    MANIFEST_PATH,
    NOTES_PATH,
    UnknownSchemaVersionError,
    UnsafeBundlePathError,
    build_zip,
    export_idea,
    import_bundle,
    write_directory,
)
from app.export.manifest import IdeaManifest
from app.main import app
from app.models import DEFAULT_USER_ID, Base, Idea
from app.repositories import idea_assets as assets_repo
from app.repositories import ideas as ideas_repo
from app.repositories import provenance as provenance_repo
from app.schemas.idea import IdeaCreate
from app.schemas.provenance import RunCreate
from app.seed import ensure_default_user
from app.storage import MemoryMediaStore, content_key

CAPTURED_AT = datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC)
TARGET_CAPTURED_AT = datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _clean_db() -> None:
    """Every test in this file talks to `app.db.engine`/`SessionLocal`
    directly (mirroring `tests/test_ideas.py::test_handle_mint_retries_
    past_a_forced_race`'s idiom), not always through `TestClient` — so,
    unlike most other test files, requesting the `client` fixture for its
    reset side effect is not guaranteed for every test here. This
    reproduces exactly what that fixture does (`tests/conftest.py`)
    without constructing a `TestClient` a given test may not need.
    """
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        ensure_default_user(session)


@pytest.fixture
def media_store() -> Iterator[MemoryMediaStore]:
    """For the router-based tests only — mirrors
    `tests/test_idea_assets.py`'s fixture of the same name."""
    store = MemoryMediaStore()
    app.dependency_overrides[get_media_store] = lambda: store
    try:
        yield store
    finally:
        app.dependency_overrides.pop(get_media_store, None)


@contextmanager
def _fresh_database() -> Generator[Session, None, None]:
    """A completely separate SQLite database — different engine, different
    connection pool, no shared state with `app.db.engine` at all.
    """
    fresh_engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(fresh_engine)
    session_factory = sessionmaker(
        bind=fresh_engine, autoflush=False, expire_on_commit=False, future=True
    )
    session = session_factory()
    try:
        ensure_default_user(session)
        yield session
    finally:
        session.close()
        fresh_engine.dispose()


def _entries_from_directory(root: Path) -> list[tuple[str, bytes]]:
    return [
        (p.relative_to(root).as_posix(), p.read_bytes())
        for p in sorted(root.rglob("*"))
        if p.is_file()
    ]


def _idea_fields(idea: Idea) -> dict[str, Any]:
    """Every `Idea` column `import_bundle` is supposed to carry over,
    excluding ids, `handle` (compared separately — it's not always
    expected to match), and timestamps — the acceptance criterion's own
    words. `captured_at` is normalised to UTC-aware before comparing:
    SQLite has no native timezone-aware storage, so whether a given
    round-trip happens to keep or drop `tzinfo` is a driver detail this
    test shouldn't be sensitive to, as long as the wall-clock instant
    (always UTC in this app) matches.
    """
    captured_at = idea.captured_at
    if captured_at.tzinfo is None:
        captured_at = captured_at.replace(tzinfo=UTC)
    return {
        "title": idea.title,
        "body": idea.body,
        "status": idea.status,
        "kinds": idea.kinds,
        "tags": idea.tags,
        "key": idea.key,
        "meter": idea.meter,
        "bpm": idea.bpm,
        "captured_at": captured_at,
    }


# ─── AC1: the round trip ────────────────────────────────────────────────


def test_round_trip_two_assets_and_one_link(tmp_path: Path) -> None:
    media_store = MemoryMediaStore()
    with SessionLocal() as db:
        target = ideas_repo.create_idea(
            db, DEFAULT_USER_ID, IdeaCreate(body="the target idea", captured_at=TARGET_CAPTURED_AT)
        )
        idea = ideas_repo.create_idea(
            db,
            DEFAULT_USER_ID,
            IdeaCreate(
                title="A sketch, café style",
                body="notes on the idea — no [[#n]] mentions in here",
                status="active",
                kinds=["melody", "harmony"],
                tags=["draft"],
                key="C",
                meter="4/4",
                bpm=120,
                captured_at=CAPTURED_AT,
            ),
        )
        ideas_repo.add_link(db, idea, target, "variant_of", "a jazzier take")

        blob1 = media_store.put_stream(io.BytesIO(b"revision one bytes"), "audio/midi")
        assets_repo.create_asset(
            db, idea, role="melody", filename="sketch.mid", blob=blob1, new_revision=False
        )
        blob2 = media_store.put_stream(
            io.BytesIO(b"revision two bytes"), "application/octet-stream"
        )
        assets_repo.create_asset(
            db, idea, role="reference", filename="ref.bin", blob=blob2, new_revision=True
        )
        db.commit()

        target_dir = tmp_path / "target"
        idea_dir = tmp_path / "idea"
        write_directory(export_idea(db, media_store, target), target_dir)
        write_directory(export_idea(db, media_store, idea), idea_dir)

        source_fields = _idea_fields(idea)
        source_assets_by_revision = {
            a.revision: (a.role, a.filename, a.mime, a.sha256, a.bytes, a.run_id)
            for a in assets_repo.list_assets(db, idea)
        }

    fresh_store = MemoryMediaStore()
    with _fresh_database() as fdb:
        target_result = import_bundle(
            fdb, fresh_store, _entries_from_directory(target_dir), DEFAULT_USER_ID
        )
        idea_result = import_bundle(
            fdb, fresh_store, _entries_from_directory(idea_dir), DEFAULT_USER_ID
        )
        fdb.commit()

        assert target_result.handle_reminted is False
        assert idea_result.handle_reminted is False
        assert idea_result.dropped_links == []

        imported_idea = idea_result.idea
        assert imported_idea.id != idea.id
        assert imported_idea.handle == idea.handle
        assert _idea_fields(imported_idea) == source_fields

        imported_assets_by_revision = {
            a.revision: (a.role, a.filename, a.mime, a.sha256, a.bytes, a.run_id)
            for a in idea_result.assets
        }
        assert imported_assets_by_revision == source_assets_by_revision
        # Content-addressing: identical bytes hash to the same key even in
        # a completely different store instance.
        assert {a.storage_key for a in idea_result.assets} == {
            content_key(v[3]) for v in source_assets_by_revision.values()
        }

        _, links_out = ideas_repo.get_idea_links(fdb, imported_idea)
        assert len(links_out) == 1
        link, other = links_out[0]
        assert link.kind == "variant_of"
        assert link.note == "a jazzier take"
        assert other.id == target_result.idea.id


# ─── Handle collision ────────────────────────────────────────────────────


def test_handle_collision_mints_new_handle_and_keeps_the_rest() -> None:
    media_store = MemoryMediaStore()
    with SessionLocal() as db:
        idea = ideas_repo.create_idea(
            db,
            DEFAULT_USER_ID,
            IdeaCreate(
                title="Keeps its content", body="body text survives", captured_at=CAPTURED_AT
            ),
        )
        db.commit()
        assert idea.handle == 1
        entries = list(export_idea(db, media_store, idea))

    fresh_store = MemoryMediaStore()
    with _fresh_database() as fdb:
        # Occupy handle 1 first, so the import has to remint.
        ideas_repo.create_idea(fdb, DEFAULT_USER_ID, IdeaCreate(body="already sitting on handle 1"))
        fdb.commit()

        result = import_bundle(fdb, fresh_store, entries, DEFAULT_USER_ID)
        fdb.commit()

        assert result.handle_reminted is True
        assert result.idea.handle == 2
        assert result.idea.title == "Keeps its content"
        assert result.idea.body == "body text survives"


# ─── Link to an absent handle ────────────────────────────────────────────


def test_link_to_absent_handle_is_dropped_not_an_error() -> None:
    media_store = MemoryMediaStore()
    with SessionLocal() as db:
        target = ideas_repo.create_idea(db, DEFAULT_USER_ID, IdeaCreate(body="never imported"))
        idea = ideas_repo.create_idea(db, DEFAULT_USER_ID, IdeaCreate(body="has a link out"))
        ideas_repo.add_link(db, idea, target, "resembles", None)
        db.commit()
        # `target` is deliberately never exported/imported — its handle
        # will not exist in the fresh database.
        entries = list(export_idea(db, media_store, idea))

    fresh_store = MemoryMediaStore()
    with _fresh_database() as fdb:
        result = import_bundle(fdb, fresh_store, entries, DEFAULT_USER_ID)
        fdb.commit()

        assert len(result.dropped_links) == 1
        assert result.dropped_links[0].kind == "resembles"
        _, links_out = ideas_repo.get_idea_links(fdb, result.idea)
        assert links_out == []


# ─── mentions: recomputed from the body, never carried ──────────────────


def test_mentions_are_recomputed_from_the_body_not_carried_from_the_manifest() -> None:
    media_store = MemoryMediaStore()
    with SessionLocal() as db:
        idea = ideas_repo.create_idea(
            db, DEFAULT_USER_ID, IdeaCreate(body="refers to [[#1]], which names nothing here yet")
        )
        db.commit()
        # No mentions edge exists in the source DB — handle 1 isn't a real
        # idea there. `ManifestLink` never carries `mentions` either way
        # (see its docstring); this proves the *target* database's live
        # handles are what get consulted, not anything shipped in the bundle.
        _, source_links_out = ideas_repo.get_idea_links(db, idea)
        assert source_links_out == []
        entries = list(export_idea(db, media_store, idea))

    fresh_store = MemoryMediaStore()
    with _fresh_database() as fdb:
        # Pre-seed an unrelated idea that lands on handle 1 in the target DB.
        anchor = ideas_repo.create_idea(
            fdb, DEFAULT_USER_ID, IdeaCreate(body="I land on handle 1 here")
        )
        fdb.commit()
        assert anchor.handle == 1

        result = import_bundle(fdb, fresh_store, entries, DEFAULT_USER_ID)
        fdb.commit()

        _, links_out = ideas_repo.get_idea_links(fdb, result.idea)
        mentions = [(link.kind, other.id) for link, other in links_out if link.kind == "mentions"]
        assert mentions == [("mentions", anchor.id)]


# ─── Unknown schema_version ───────────────────────────────────────────────


def test_unknown_schema_version_raises() -> None:
    bad_manifest = yaml.safe_dump({"schema_version": 999, "id": str(uuid.uuid4())}, sort_keys=False)
    fresh_store = MemoryMediaStore()
    with _fresh_database() as fdb, pytest.raises(UnknownSchemaVersionError):
        import_bundle(
            fdb,
            fresh_store,
            [(MANIFEST_PATH, bad_manifest.encode()), (NOTES_PATH, b"")],
            DEFAULT_USER_ID,
        )


# ─── Path traversal: refused by both sinks (and by import) ───────────────


def test_write_directory_refuses_path_traversal(tmp_path: Path) -> None:
    with pytest.raises(UnsafeBundlePathError):
        write_directory([("../../etc/passwd", b"evil")], tmp_path)


def test_build_zip_refuses_path_traversal() -> None:
    with pytest.raises(UnsafeBundlePathError):
        build_zip([("../../etc/passwd", b"evil")])


def test_import_bundle_refuses_path_traversal() -> None:
    fresh_store = MemoryMediaStore()
    with _fresh_database() as fdb, pytest.raises(UnsafeBundlePathError):
        import_bundle(fdb, fresh_store, [("../../etc/passwd", b"evil")], DEFAULT_USER_ID)


# ─── properties: always empty (this ticket's mandated scope decision) ────


def test_manifest_properties_is_always_empty() -> None:
    media_store = MemoryMediaStore()
    with SessionLocal() as db:
        idea = ideas_repo.create_idea(
            db, DEFAULT_USER_ID, IdeaCreate(body="plain idea, no lineage")
        )
        db.commit()
        entries = list(export_idea(db, media_store, idea))
    manifest = IdeaManifest.model_validate(yaml.safe_load(dict(entries)[MANIFEST_PATH]))
    assert manifest.properties == []


# ─── producer: derived from run_id, provenance-only on import ───────────


def test_derived_asset_producer_is_the_extractor_name_but_run_id_is_not_restored() -> None:
    media_store = MemoryMediaStore()
    with SessionLocal() as db:
        idea = ideas_repo.create_idea(db, DEFAULT_USER_ID, IdeaCreate(body="has a derived asset"))
        run_data = RunCreate.model_validate(
            {
                "subjectKind": "idea",
                "subjectId": f"idea:{idea.id}",
                "extractor": "midi-render",
                "extractorVersion": "1.0.0",
                "executor": "external",
                "inputSha256s": [],
                "status": "succeeded",
                "properties": [],
            }
        )
        run, _created = provenance_repo.get_or_create_completed_run(
            db, DEFAULT_USER_ID, run_data, "succeeded", [], None
        )
        blob = media_store.put_stream(io.BytesIO(b"rendered audio bytes"), "audio/opus")
        assets_repo.create_asset(
            db,
            idea,
            role="render",
            filename="render.opus",
            blob=blob,
            new_revision=False,
            run_id=run.id,
        )
        db.commit()
        entries = list(export_idea(db, media_store, idea))

    manifest = IdeaManifest.model_validate(yaml.safe_load(dict(entries)[MANIFEST_PATH]))
    assert manifest.assets[0].producer == "midi-render"

    fresh_store = MemoryMediaStore()
    with _fresh_database() as fdb:
        result = import_bundle(fdb, fresh_store, entries, DEFAULT_USER_ID)
        fdb.commit()
        # Provenance-only in the manifest — see `ManifestAsset.producer`'s
        # docstring: `import_bundle` never recreates an `ExtractionRun` row.
        assert result.assets[0].run_id is None


# ─── AC2: the zip endpoint ────────────────────────────────────────────────


def test_export_endpoint_returns_a_valid_zip_with_a_validating_manifest(
    client: TestClient, media_store: MemoryMediaStore
) -> None:
    r = client.post("/v1/ideas", json={"title": "Zippable", "body": "some notes about it"})
    assert r.status_code == 201
    idea_id = r.json()["id"]
    upload = client.post(
        f"/v1/ideas/{idea_id}/assets",
        files={"file": ("a.bin", b"asset bytes", "application/octet-stream")},
        data={"role": "reference"},
    )
    assert upload.status_code == 201

    resp = client.get(f"/v1/ideas/{idea_id}/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"
    assert "content-disposition" in resp.headers
    assert ".zip" in resp.headers["content-disposition"]

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        names = zf.namelist()
        assert MANIFEST_PATH in names
        assert NOTES_PATH in names
        manifest_raw = yaml.safe_load(zf.read(MANIFEST_PATH))
        manifest = IdeaManifest.model_validate(manifest_raw)
        assert manifest.schema_version == 1
        assert manifest.title == "Zippable"
        assert len(manifest.assets) == 1
        assert manifest.assets[0].sha256 == upload.json()["sha256"]


def test_export_missing_idea_is_404(client: TestClient, media_store: MemoryMediaStore) -> None:
    r = client.get(f"/v1/ideas/{uuid.uuid4()}/export")
    assert r.status_code == 404
