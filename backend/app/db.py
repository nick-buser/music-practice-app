"""Database engine, session factory, and the FastAPI session dependency.

Deliberately *synchronous* SQLAlchemy 2.0 (psycopg 3): FastAPI runs sync
dependencies in a threadpool, which is plenty for CRUD and avoids the
async-session lifecycle traps. Revisit only with a concrete I/O-bound reason.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings


def _make_engine() -> Engine:
    if settings.is_sqlite:
        # Shared in-memory DB across threads for the test suite.
        from sqlalchemy.pool import StaticPool

        return create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
    return create_engine(settings.database_url, pool_pre_ping=True, future=True)


engine: Engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def get_db() -> Iterator[Session]:
    """Per-request session; commits on success, rolls back on error."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
