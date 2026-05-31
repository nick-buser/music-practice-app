from __future__ import annotations

from fastapi.testclient import TestClient
from tests.conftest import CMAJ7_IDENTITY


def test_chord_crud_lifecycle(client: TestClient) -> None:
    # create
    r = client.post("/v1/chords", json={"label": "Cmaj7", "identity": CMAJ7_IDENTITY})
    assert r.status_code == 201
    body = r.json()
    chord_id = body["id"]
    assert body["label"] == "Cmaj7"
    assert body["identity"]["voicing"]["rootOctave"] == 4  # camelCase preserved
    assert "createdAt" in body and "updatedAt" in body

    # list
    listed = client.get("/v1/chords").json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == chord_id

    # get
    assert client.get(f"/v1/chords/{chord_id}").status_code == 200

    # patch
    r = client.patch(f"/v1/chords/{chord_id}", json={"label": "renamed"})
    assert r.status_code == 200
    assert r.json()["label"] == "renamed"

    # soft delete → gone from reads
    assert client.delete(f"/v1/chords/{chord_id}").status_code == 204
    assert client.get(f"/v1/chords/{chord_id}").status_code == 404
    assert client.get("/v1/chords").json()["total"] == 0


def test_accepts_client_minted_id(client: TestClient) -> None:
    cid = "11111111-1111-1111-1111-111111111111"
    r = client.post("/v1/chords", json={"id": cid, "identity": CMAJ7_IDENTITY})
    assert r.status_code == 201
    assert r.json()["id"] == cid


def test_missing_chord_is_problem_json(client: TestClient) -> None:
    r = client.get("/v1/chords/22222222-2222-2222-2222-222222222222")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/problem+json")
    body = r.json()
    assert body["title"] == "Chord not found"
    assert body["status"] == 404


def test_rejects_malformed_identity(client: TestClient) -> None:
    r = client.post("/v1/chords", json={"identity": {"root": {"letter": "H"}}})
    assert r.status_code == 422
    assert r.headers["content-type"].startswith("application/problem+json")
