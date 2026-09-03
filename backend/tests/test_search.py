"""SB5: the `parse_query` grammar (unit) and `GET /v1/ideas?q=` on the
SQLite path (API-level, via the `client` fixture — see `test_ideas.py` for
the idiom this borrows). The Postgres tsvector path this same query
compiles to on a real server is exercised only in
`test_integration_postgres.py`, which this laptop can't run.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from app.search import ParsedQuery, parse_query

# ─── parse_query (pure, unit) ───────────────────────────────────────────


def test_tags_kinds_and_free_text_all_parse_out() -> None:
    parsed = parse_query("tag:piano kind:melody blue light")
    assert parsed == ParsedQuery(tags=("piano",), kinds=("melody",), text="blue light")


def test_unknown_prefix_stays_free_text() -> None:
    parsed = parse_query("composer:bach")
    assert parsed == ParsedQuery(text="composer:bach")


def test_status_frobnicate_is_not_a_real_status_so_stays_free_text() -> None:
    parsed = parse_query("status:frobnicate")
    assert parsed == ParsedQuery(text="status:frobnicate")


def test_known_status_values_parse_out_case_insensitively() -> None:
    assert parse_query("status:active").statuses == ("active",)
    assert parse_query("status:ACTIVE").statuses == ("active",)  # value folds to lowercase
    assert parse_query("STATUS:done").statuses == ("done",)  # prefix is case-insensitive too


def test_none_and_empty_and_whitespace_only_all_yield_an_all_empty_query() -> None:
    assert parse_query(None) == ParsedQuery()
    assert parse_query("") == ParsedQuery()
    assert parse_query("   ") == ParsedQuery()


def test_key_token_parses_out() -> None:
    parsed = parse_query("key:Cmaj a sad little tune")
    assert parsed.keys == ("Cmaj",)
    assert parsed.text == "a sad little tune"


def test_multiples_of_the_same_prefix_all_collect_in_order() -> None:
    parsed = parse_query("tag:piano tag:jazz kind:melody kind:harmony")
    assert parsed.tags == ("piano", "jazz")
    assert parsed.kinds == ("melody", "harmony")


def test_quoted_value_strips_one_layer_of_matching_quotes() -> None:
    # Tokenizing is pure whitespace-split, so a quoted value can only ever
    # be a single word here — quotes around a *phrase* would just split
    # into two ordinary tokens, same as without them.
    assert parse_query('tag:"piano"').tags == ("piano",)
    assert parse_query("tag:'jazz'").tags == ("jazz",)
    # Mismatched quotes aren't a matching pair — left as-is.
    assert parse_query("tag:'jazz\"").tags == ("'jazz\"",)


def test_bare_colon_and_empty_value_both_stay_free_text() -> None:
    parsed = parse_query(": tag: blue")
    assert parsed.tags == ()
    assert parsed.text == ": tag: blue"


def test_free_text_preserves_original_token_order_around_prefixed_tokens() -> None:
    parsed = parse_query("a tag:piano b kind:melody c")
    assert parsed.text == "a b c"
    assert parsed.tags == ("piano",)
    assert parsed.kinds == ("melody",)


# ─── GET /v1/ideas?q= on the SQLite path (API-level) ────────────────────


def _payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"body": "a scrap of melody"}
    payload.update(overrides)
    return payload


def _seed_ideas(client: TestClient) -> dict[str, Any]:
    blue = client.post(
        "/v1/ideas",
        json=_payload(
            title="Blue Reverie",
            body="a slow, aching chord progression under a night sky",
            status="active",
            kinds=["harmony"],
            tags=["blue", "draft"],
        ),
    ).json()
    gold = client.post(
        "/v1/ideas",
        json=_payload(
            title="Golden Hook",
            body="a fast bright riff that wants a chorus",
            status="inbox",
            kinds=["melody"],
            tags=["gold"],
        ),
    ).json()
    return {"blue": blue, "gold": gold}


def test_q_free_text_matches_title_body_and_tags(client: TestClient) -> None:
    seeded = _seed_ideas(client)

    by_title = client.get("/v1/ideas?q=reverie").json()
    assert {i["id"] for i in by_title["items"]} == {seeded["blue"]["id"]}

    by_body = client.get("/v1/ideas?q=chorus").json()
    assert {i["id"] for i in by_body["items"]} == {seeded["gold"]["id"]}

    by_tag_text = client.get("/v1/ideas?q=gold").json()
    assert {i["id"] for i in by_tag_text["items"]} == {seeded["gold"]["id"]}

    no_match = client.get("/v1/ideas?q=trombone").json()
    assert no_match["items"] == []


def test_q_tag_kind_and_status_prefixes_filter_like_the_explicit_params(
    client: TestClient,
) -> None:
    seeded = _seed_ideas(client)

    by_q_tag = client.get("/v1/ideas?q=tag:blue").json()
    by_param_tag = client.get("/v1/ideas?tag=blue").json()
    assert {i["id"] for i in by_q_tag["items"]} == {seeded["blue"]["id"]}
    assert {i["id"] for i in by_q_tag["items"]} == {i["id"] for i in by_param_tag["items"]}

    by_q_kind = client.get("/v1/ideas?q=kind:melody").json()
    by_param_kind = client.get("/v1/ideas?kind=melody").json()
    assert {i["id"] for i in by_q_kind["items"]} == {seeded["gold"]["id"]}
    assert {i["id"] for i in by_q_kind["items"]} == {i["id"] for i in by_param_kind["items"]}


def test_explicit_status_param_and_q_status_prefix_agree(client: TestClient) -> None:
    seeded = _seed_ideas(client)

    by_param = client.get("/v1/ideas?status=active").json()
    by_q = client.get("/v1/ideas?q=status:active").json()
    assert {i["id"] for i in by_param["items"]} == {seeded["blue"]["id"]}
    assert {i["id"] for i in by_param["items"]} == {i["id"] for i in by_q["items"]}


def test_q_combines_a_prefix_and_free_text(client: TestClient) -> None:
    seeded = _seed_ideas(client)

    # tag:blue narrows to the "Blue Reverie" idea; "sky" only matches its body.
    combined = client.get("/v1/ideas?q=tag:blue sky").json()
    assert {i["id"] for i in combined["items"]} == {seeded["blue"]["id"]}

    # tag:blue narrows correctly, but "chorus" only appears in the *other*
    # idea's body — the AND across facets means neither idea matches.
    contradictory = client.get("/v1/ideas?q=tag:blue chorus").json()
    assert contradictory["items"] == []


def test_q_status_that_is_not_a_real_status_falls_back_to_free_text_and_matches_nothing(
    client: TestClient,
) -> None:
    _seed_ideas(client)
    # No idea's title/body/tags literally contains "status:frobnicate".
    result = client.get("/v1/ideas?q=status:frobnicate").json()
    assert result["items"] == []
