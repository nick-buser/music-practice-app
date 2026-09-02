"""Ideas API: handle minting (incl. the soft-delete-never-reuses-a-handle
rule), `[[#n]]` mentions edges, filters, and the links endpoints. See
docs/sketchbook.md for the object this implements.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.models import DEFAULT_USER_ID
from app.repositories import ideas as repo
from app.schemas.idea import IdeaCreate


def _payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"body": "a scrap of melody"}
    payload.update(overrides)
    return payload


# ─── handle minting ─────────────────────────────────────────────────────


def test_two_creates_get_sequential_handles(client: TestClient) -> None:
    r1 = client.post("/v1/ideas", json=_payload())
    r2 = client.post("/v1/ideas", json=_payload())
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["handle"] == 1
    assert r2.json()["handle"] == 2


def test_soft_deleted_ideas_handle_is_never_reused(client: TestClient) -> None:
    r1 = client.post("/v1/ideas", json=_payload())
    idea1_id = r1.json()["id"]
    assert r1.json()["handle"] == 1

    assert client.delete(f"/v1/ideas/{idea1_id}").status_code == 204

    r2 = client.post("/v1/ideas", json=_payload())
    assert r2.json()["handle"] == 2  # not 1 — handle 1's owner was soft-deleted, not freed


def test_handle_mint_retries_past_a_forced_race(client: TestClient, monkeypatch: Any) -> None:
    """Proves `create_idea`'s bounded IntegrityError-retry actually recovers,
    not just that sequential creates happen to avoid the race. Forces
    `_next_handle` to return a stale (already-taken) value once, exactly as
    a real concurrent create would.
    """
    r1 = client.post("/v1/ideas", json=_payload())
    assert r1.json()["handle"] == 1

    real_next_handle = repo._next_handle  # pyright: ignore[reportPrivateUsage]
    calls = {"n": 0}

    def _flaky_next_handle(db: Any, user_id: Any) -> int:
        calls["n"] += 1
        if calls["n"] == 1:
            return 1  # collides with the idea created above
        return real_next_handle(db, user_id)

    monkeypatch.setattr(repo, "_next_handle", _flaky_next_handle)

    with SessionLocal() as db:
        idea = repo.create_idea(db, DEFAULT_USER_ID, IdeaCreate(body="raced in"))
        db.commit()
        assert idea.handle == 2
    assert calls["n"] == 2  # one collision, one successful remint


# ─── [[#n]] mentions edges ──────────────────────────────────────────────


def test_mentions_edge_created_updated_and_removed(client: TestClient) -> None:
    target = client.post("/v1/ideas", json=_payload(body="the target idea")).json()
    assert target["handle"] == 1

    source = client.post(
        "/v1/ideas", json=_payload(body=f"builds on [[#{target['handle']}]]")
    ).json()
    assert source["handle"] == 2
    assert len(source["linksOut"]) == 1
    edge = source["linksOut"][0]
    assert edge["kind"] == "mentions"
    assert edge["handle"] == 1
    assert edge["title"] is None

    # The other side sees it too, as an inbound edge.
    got_target = client.get(f"/v1/ideas/{target['id']}").json()
    assert len(got_target["linksIn"]) == 1
    assert got_target["linksIn"][0]["handle"] == 2

    # Editing the body to drop the reference removes the edge.
    patched = client.patch(f"/v1/ideas/{source['id']}", json={"body": "no more mentions"}).json()
    assert patched["linksOut"] == []
    got_target = client.get(f"/v1/ideas/{target['id']}").json()
    assert got_target["linksIn"] == []


def test_mention_of_unknown_handle_is_silently_dropped(client: TestClient) -> None:
    r = client.post("/v1/ideas", json=_payload(body="dangling reference [[#999]]"))
    assert r.status_code == 201
    assert r.json()["linksOut"] == []


def test_mention_of_own_handle_produces_no_self_edge(client: TestClient) -> None:
    # A create can't literally guess its own not-yet-minted handle, but an
    # update to reference it back should still produce no self-loop.
    idea = client.post("/v1/ideas", json=_payload(body="start")).json()
    patched = client.patch(
        f"/v1/ideas/{idea['id']}", json={"body": f"[[#{idea['handle']}]] self reference"}
    ).json()
    assert patched["linksOut"] == []
    assert patched["linksIn"] == []


# ─── filters, empty create, list order ──────────────────────────────────


def test_empty_body_inbox_create_round_trips(client: TestClient) -> None:
    r = client.post("/v1/ideas", json={})
    assert r.status_code == 201
    body = r.json()
    assert body["body"] == ""
    assert body["status"] == "inbox"
    assert body["handle"] == 1


def test_list_status_kind_tag_filters_and_newest_first(client: TestClient) -> None:
    client.post(
        "/v1/ideas",
        json=_payload(body="one", status="inbox", kinds=["melody"], tags=["draft"]),
    )
    client.post(
        "/v1/ideas",
        json=_payload(body="two", status="active", kinds=["harmony"], tags=["draft"]),
    )
    client.post(
        "/v1/ideas",
        json=_payload(body="three", status="active", kinds=["melody"], tags=["polished"]),
    )

    page = client.get("/v1/ideas").json()
    assert [i["body"] for i in page["items"]] == ["three", "two", "one"]  # newest captured_at first

    by_status = client.get("/v1/ideas?status=active").json()
    assert {i["body"] for i in by_status["items"]} == {"two", "three"}

    by_kind = client.get("/v1/ideas?kind=melody").json()
    assert {i["body"] for i in by_kind["items"]} == {"one", "three"}

    by_tag = client.get("/v1/ideas?tag=polished").json()
    assert {i["body"] for i in by_tag["items"]} == {"three"}


def test_patch_and_soft_delete(client: TestClient) -> None:
    idea = client.post("/v1/ideas", json=_payload()).json()

    patched = client.patch(f"/v1/ideas/{idea['id']}", json={"title": "renamed", "bpm": 120})
    assert patched.status_code == 200
    assert patched.json()["title"] == "renamed"
    assert patched.json()["bpm"] == 120

    assert client.delete(f"/v1/ideas/{idea['id']}").status_code == 204
    assert client.get(f"/v1/ideas/{idea['id']}").status_code == 404
    assert client.get("/v1/ideas").json()["total"] == 0


# ─── manual links endpoint ───────────────────────────────────────────────


def test_manual_link_create_and_delete(client: TestClient) -> None:
    a = client.post("/v1/ideas", json=_payload(title="A")).json()
    b = client.post("/v1/ideas", json=_payload(title="B")).json()

    r = client.post(
        f"/v1/ideas/{a['id']}/links", json={"toId": b["id"], "kind": "variant_of", "note": "close"}
    )
    assert r.status_code == 201
    edge = r.json()
    assert edge["kind"] == "variant_of"
    assert edge["handle"] == b["handle"]
    assert edge["title"] == "B"

    got_a = client.get(f"/v1/ideas/{a['id']}").json()
    assert len(got_a["linksOut"]) == 1
    got_b = client.get(f"/v1/ideas/{b['id']}").json()
    assert len(got_b["linksIn"]) == 1

    assert client.delete(f"/v1/ideas/{a['id']}/links/{edge['id']}").status_code == 204
    got_a = client.get(f"/v1/ideas/{a['id']}").json()
    assert got_a["linksOut"] == []


def test_manual_link_rejects_self_and_duplicates(client: TestClient) -> None:
    a = client.post("/v1/ideas", json=_payload()).json()
    b = client.post("/v1/ideas", json=_payload()).json()

    self_link = client.post(
        f"/v1/ideas/{a['id']}/links", json={"toId": a["id"], "kind": "resembles"}
    )
    assert self_link.status_code == 422

    first = client.post(f"/v1/ideas/{a['id']}/links", json={"toId": b["id"], "kind": "resembles"})
    assert first.status_code == 201
    dup = client.post(f"/v1/ideas/{a['id']}/links", json={"toId": b["id"], "kind": "resembles"})
    assert dup.status_code == 409


def test_manual_link_to_unknown_idea_is_404(client: TestClient) -> None:
    a = client.post("/v1/ideas", json=_payload()).json()
    r = client.post(
        f"/v1/ideas/{a['id']}/links",
        json={"toId": "00000000-0000-0000-0000-000000000099", "kind": "resembles"},
    )
    assert r.status_code == 404
