"""Dump the OpenAPI schema to backend/openapi.json.

This is the contract artifact: commit it, generate the TS client from it in CI
(`openapi-typescript`), and fail the build on drift.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.main import app


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "openapi.json"
    out.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
