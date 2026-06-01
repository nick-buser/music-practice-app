"""Dump the OpenAPI schema to backend/openapi.json.

This is the contract artifact: commit it, generate the TS client from it in CI
(`openapi-typescript`), and fail the build on drift. `render()` is the single
serialization both this script and the drift test use, so they can't disagree.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.main import app

OPENAPI_PATH = Path(__file__).resolve().parents[1] / "openapi.json"


def render() -> str:
    return json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"


def main() -> None:
    OPENAPI_PATH.write_text(render())
    print(f"wrote {OPENAPI_PATH}")


if __name__ == "__main__":
    main()
