"""Test harness.

The default suite runs against in-memory SQLite (fast, no Docker) via the app's
own engine — the JSON-with-variant column type means the same models work on
both SQLite and Postgres. The real-Postgres fidelity check lives behind the
`integration` marker (see tests/test_integration_postgres.py).
"""

from __future__ import annotations

import os
from collections.abc import Iterator

os.environ.setdefault("ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal, engine
from app.main import app
from app.models import Base
from app.seed import ensure_default_user

CMAJ7_IDENTITY = {
    "root": {"letter": "C", "accidental": "natural"},
    "quality": "major",
    "seventh": "maj7",
    "extensions": [7],
    "alterations": [],
    "voicing": {"type": "block", "inversion": 0, "rootOctave": 4, "doubleRoot": False},
}


@pytest.fixture
def client() -> Iterator[TestClient]:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        ensure_default_user(session)
    yield TestClient(app)
