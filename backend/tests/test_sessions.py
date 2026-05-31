from __future__ import annotations

from fastapi.testclient import TestClient


def _payload() -> dict[str, object]:
    return {
        "subjectId": "c-maj7-chord~drop2",
        "startedAt": "2026-05-31T06:18:00Z",
        "durationSeconds": 300,
        "bpm": 96,
    }


def test_session_crud_lifecycle(client: TestClient) -> None:
    r = client.post("/v1/sessions", json=_payload())
    assert r.status_code == 201
    body = r.json()
    sid = body["id"]
    assert body["subjectId"] == "c-maj7-chord~drop2"
    assert body["durationSeconds"] == 300

    assert client.get("/v1/sessions").json()["total"] == 1

    r = client.patch(f"/v1/sessions/{sid}", json={"bpm": 104, "notes": "smoother"})
    assert r.status_code == 200
    assert r.json()["bpm"] == 104
    assert r.json()["notes"] == "smoother"

    assert client.delete(f"/v1/sessions/{sid}").status_code == 204
    assert client.get("/v1/sessions").json()["total"] == 0


def test_pagination_envelope(client: TestClient) -> None:
    for _ in range(3):
        client.post("/v1/sessions", json=_payload())
    page = client.get("/v1/sessions?limit=2&offset=0").json()
    assert page["total"] == 3
    assert len(page["items"]) == 2
    assert page["limit"] == 2 and page["offset"] == 0
