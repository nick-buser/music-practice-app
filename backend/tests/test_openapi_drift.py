"""Backend ↔ contract drift guard.

The committed openapi.json must equal what the live app generates — i.e. the
Pydantic models, routes, and the problem+json customisation are all reflected
in the contract the frontend codegen consumes. If a model changes without
re-exporting, this fails with the fix command.
"""

from __future__ import annotations

from scripts.export_openapi import OPENAPI_PATH, render


def test_committed_openapi_is_in_sync() -> None:
    committed = OPENAPI_PATH.read_text()
    assert committed == render(), (
        "openapi.json is stale — run `uv run python scripts/export_openapi.py` "
        "and commit the result."
    )
