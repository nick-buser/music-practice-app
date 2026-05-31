"""Real-Postgres fidelity check (opt-in: `pytest -m integration`, needs Docker).

Proves the bits SQLite can't: JSONB storage/readback, native UUID, and
server-default timestamps populated on insert.
"""

from __future__ import annotations

import pytest

pytest.importorskip("testcontainers")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import DEFAULT_USER_ID, Base, SavedChord, User

IDENTITY = {
    "root": {"letter": "C", "accidental": "natural"},
    "quality": "major",
    "seventh": "min7",
    "extensions": [7],
    "alterations": [],
    "voicing": {"type": "block", "inversion": 0, "rootOctave": 4, "doubleRoot": False},
}


@pytest.mark.integration
def test_jsonb_and_defaults_roundtrip_on_postgres() -> None:
    import docker
    from testcontainers.postgres import PostgresContainer

    try:
        docker.from_env().ping()
    except Exception:
        pytest.skip("Docker daemon not reachable")

    with PostgresContainer("postgres:16-alpine", driver="psycopg") as pg:
        engine = create_engine(pg.get_connection_url(), future=True)
        Base.metadata.create_all(engine)

        with Session(engine) as s:
            s.add(User(id=DEFAULT_USER_ID, display_name="Default User"))
            chord = SavedChord(user_id=DEFAULT_USER_ID, label="C7", identity=IDENTITY)
            s.add(chord)
            s.commit()
            chord_id = chord.id
            assert chord.created_at is not None  # server default fetched via RETURNING

        with Session(engine) as s:
            got = s.get(SavedChord, chord_id)
            assert got is not None
            assert got.identity["voicing"]["rootOctave"] == 4  # JSONB round-trips

        engine.dispose()
