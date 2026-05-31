"""Liveness and readiness probes (kept out of /v1 so infra can hit them plainly)."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.db import engine

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz() -> dict[str, str]:
    """Liveness — the process is up."""
    return {"status": "ok"}


@router.get("/readyz")
def readyz() -> dict[str, str]:
    """Readiness — the database is reachable."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ready"}
