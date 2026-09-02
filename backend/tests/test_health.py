from __future__ import annotations

from fastapi.testclient import TestClient


def test_healthz(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    # No S3 env in the test process → MemoryMediaStore → "unconfigured". See
    # tests/test_storage.py for the full storage-status matrix.
    assert r.json() == {"status": "ok", "storage": "unconfigured"}


def test_readyz_checks_db(client: TestClient) -> None:
    r = client.get("/readyz")
    assert r.status_code == 200
    assert r.json() == {"status": "ready"}
