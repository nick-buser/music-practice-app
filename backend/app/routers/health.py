"""Liveness and readiness probes (kept out of /v1 so infra can hit them plainly)."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.db import engine
from app.deps import MediaStoreDep

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz(store: MediaStoreDep) -> dict[str, str]:
    """Liveness — the process is up.

    Wired to the startup, readiness, AND liveness probes for every api pod, so
    this handler must always return 200 no matter what storage is doing —
    `storage` in the body carries that state instead. `MediaStore.healthcheck()`
    is the contract that makes that safe (never raises, never hangs); this
    handler adds nothing on top that could break it.
    """
    return {"status": "ok", "storage": store.healthcheck()}


@router.get("/readyz")
def readyz() -> dict[str, str]:
    """Readiness — the database is reachable."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ready"}
