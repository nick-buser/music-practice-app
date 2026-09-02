"""Real-Postgres fidelity check (opt-in: `pytest -m integration`, needs
`DATABASE_URL` pointing at a real Postgres — see `.woodpecker/backend.yml`'s
`test-postgres` step, which sets one against a `postgres:16` service).

Two things SQLite can't prove:
  1. JSONB storage/readback, native UUID PKs, and server-default timestamps
     populated on insert.
  2. That the Alembic migrations actually apply and reverse against a real
     server, not just describe a schema SQLAlchemy already agrees with.

Both tests reset the schema before doing their own work rather than trusting
run order — they act on the same database, and either one left running after
the other (tables present vs. absent, `alembic_version` stamped vs. not)
would otherwise make the second test's outcome depend on which ran first.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, inspect, select, text
from sqlalchemy.orm import Session

from app.models import DEFAULT_USER_ID, Base, ExtractedProperty, IdeaLink, SavedChord, User
from app.repositories import ideas as ideas_repo
from app.repositories import provenance as provenance_repo
from app.schemas.idea import IdeaCreate
from app.schemas.provenance import RunCreate

IDENTITY = {
    "root": {"letter": "C", "accidental": "natural"},
    "quality": "major",
    "seventh": "min7",
    "extensions": [7],
    "alterations": [],
    "voicing": {"type": "block", "inversion": 0, "rootOctave": 4, "doubleRoot": False},
}

# The tables `migrations/versions/0001_initial.py`, `0002_provenance.py`,
# and `0003_ideas.py` create/drop — kept in sync with `Base.metadata` by
# convention, not by import, since the migration round-trip test asserts
# against the *migration's* behavior, not the ORM's.
APP_TABLES = {
    "users",
    "saved_chords",
    "practice_sessions",
    "extraction_runs",
    "extracted_properties",
    "ideas",
    "idea_links",
}


def _postgres_database_url() -> str:
    """The real-Postgres `DATABASE_URL` for this run, or skip.

    `tests/conftest.py` only `setdefault`s `DATABASE_URL` to in-memory SQLite,
    so an externally-provided value (the CI step's Postgres service) already
    wins by the time this runs. Locally, with nothing set, there is no
    Postgres on this laptop to fall back to — skip rather than try to start
    one.
    """
    url = os.environ.get("DATABASE_URL")
    if not url or url.startswith("sqlite"):
        pytest.skip("DATABASE_URL is not set to a real Postgres; run with -m integration in CI")
    return url


def _reset_schema(engine: Engine) -> None:
    """Wipe both the ORM-known tables and Alembic's bookkeeping table.

    Covers whatever state the *other* test in this module could have left
    behind (tables created via `Base.metadata`, or via a migration that
    stamped `alembic_version`), so each test starts from a truly empty
    database regardless of execution order.
    """
    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))


def _alembic_config() -> Config:
    # `Config("alembic.ini")` resolves `script_location` relative to the
    # process CWD, which pytest does not guarantee is `backend/`. Anchor both
    # paths off this test file's location instead.
    backend_root = Path(__file__).resolve().parent.parent
    cfg = Config(str(backend_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_root / "migrations"))
    return cfg


@pytest.mark.integration
def test_jsonb_and_defaults_roundtrip_on_postgres() -> None:
    engine = create_engine(_postgres_database_url(), future=True)
    try:
        _reset_schema(engine)
        Base.metadata.create_all(engine)

        with Session(engine) as s:
            s.add(User(id=DEFAULT_USER_ID, display_name="Default User"))
            # No `relationship()` ties User <-> SavedChord (the FK is a bare
            # column constraint), so the unit of work has no ordering hint
            # between the two inserts. SQLite never enforces the FK either
            # way, but Postgres does — flush the user row first so it exists
            # before the chord insert is emitted.
            s.flush()
            chord = SavedChord(user_id=DEFAULT_USER_ID, label="C7", identity=IDENTITY)
            s.add(chord)
            s.commit()
            chord_id = chord.id
            assert chord.created_at is not None  # server default fetched via RETURNING

        with Session(engine) as s:
            got = s.get(SavedChord, chord_id)
            assert got is not None
            assert got.identity["voicing"]["rootOctave"] == 4  # JSONB round-trips
    finally:
        engine.dispose()


@pytest.mark.integration
def test_completed_run_and_properties_insert_without_fk_violation_on_postgres() -> None:
    """Exercises the exact shape OPS2 found broken (2026-09-02): a run and
    its properties added to one `Session` and flushed together, with no
    `relationship()` between `ExtractionRun` and `ExtractedProperty` (see the
    load-bearing flush comment in `app/repositories/provenance.py`). SQLite
    can't catch a regression here (`PRAGMA foreign_keys` is off by default,
    so `tests/test_provenance.py` would pass even if the flush were removed);
    Postgres enforces the FK and raises `ForeignKeyViolation` the instant a
    property's `run_id` is inserted before its run exists. This is the one
    test that actually proves the insert order, not just the row values.
    """
    engine = create_engine(_postgres_database_url(), future=True)
    try:
        _reset_schema(engine)
        Base.metadata.create_all(engine)

        with Session(engine) as s:
            s.add(User(id=DEFAULT_USER_ID, display_name="Default User"))
            s.flush()

            data = RunCreate.model_validate(
                {
                    "subjectKind": "piece",
                    "subjectId": "pg-ordering-guard",
                    "extractor": "scorer",
                    "extractorVersion": "1.0.0",
                    "executor": "client",
                    "params": {},
                    "inputSha256s": ["h1"],
                    "status": "succeeded",
                    "properties": [{"kind": "tempo_curve", "payload": {"x": 1}}],
                }
            )
            run, created = provenance_repo.get_or_create_completed_run(
                s, DEFAULT_USER_ID, data, "succeeded", data.properties, None
            )
            s.commit()
            assert created
            run_id = run.id

        with Session(engine) as s:
            props = s.scalars(
                select(ExtractedProperty).where(ExtractedProperty.run_id == run_id)
            ).all()
            assert len(props) == 1
            assert props[0].payload["x"] == 1
    finally:
        engine.dispose()


@pytest.mark.integration
def test_idea_create_with_mentions_inserts_without_fk_violation_on_postgres() -> None:
    """The SB1 analogue of the guard above: creating an idea whose body
    mentions another idea adds the idea row and its `mentions` IdeaLink row
    to one `Session` and flushes them together, with no `relationship()`
    between Idea and IdeaLink (see the load-bearing flush in
    app/repositories/ideas.py::create_idea). SQLite can't catch a
    regression here either; Postgres raises `ForeignKeyViolation` the
    instant an IdeaLink's `from_id` is inserted before its idea exists.
    """
    engine = create_engine(_postgres_database_url(), future=True)
    try:
        _reset_schema(engine)
        Base.metadata.create_all(engine)

        with Session(engine) as s:
            s.add(User(id=DEFAULT_USER_ID, display_name="Default User"))
            s.flush()
            target = ideas_repo.create_idea(s, DEFAULT_USER_ID, IdeaCreate(body="the target idea"))
            s.commit()
            target_handle = target.handle

        with Session(engine) as s:
            source = ideas_repo.create_idea(
                s, DEFAULT_USER_ID, IdeaCreate(body=f"builds on [[#{target_handle}]]")
            )
            s.commit()
            source_id = source.id

        with Session(engine) as s:
            links = s.scalars(select(IdeaLink).where(IdeaLink.from_id == source_id)).all()
            assert len(links) == 1
            assert links[0].kind == "mentions"
    finally:
        engine.dispose()


@pytest.mark.integration
def test_alembic_upgrade_downgrade_upgrade_roundtrip() -> None:
    """`upgrade head` -> `downgrade base` -> `upgrade head`, asserted at each stage.

    `app.config.settings` is an `lru_cache`'d singleton read at import time, so
    `migrations/env.py` (which builds its engine from `settings.database_url`)
    picks up whatever `DATABASE_URL` was in the environment when `app.config`
    first got imported — in the CI step that's the same Postgres URL
    `_postgres_database_url()` returns below, so both routes agree.

    Must leave the database at head when it finishes, since the JSONB test
    above (or a later run) may run against the same database next.
    """
    engine = create_engine(_postgres_database_url(), future=True)
    try:
        _reset_schema(engine)
        cfg = _alembic_config()

        command.upgrade(cfg, "head")
        tables = set(inspect(engine).get_table_names())
        assert tables >= APP_TABLES

        command.downgrade(cfg, "base")
        tables = set(inspect(engine).get_table_names())
        assert not (APP_TABLES & tables)

        command.upgrade(cfg, "head")
        tables = set(inspect(engine).get_table_names())
        assert tables >= APP_TABLES
    finally:
        engine.dispose()
