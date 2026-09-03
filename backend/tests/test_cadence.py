"""Recording cadences: `PUT` upsert + `GET` list — RC3. See
docs/recordings-provenance.md and `app/models/recording.py`'s
`RecordingCadence` docstring for the NULL-means-"off" convention this file
pins directly (criterion 2: a second `PUT` updates in place, never a second
row or a 409).
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient


def _put_cadence(
    client: TestClient, subject_kind: str, subject_id: str, interval_days: int | None
) -> Any:
    return client.put(
        f"/v1/recording-cadences/{subject_kind}/{subject_id}",
        json={"intervalDays": interval_days},
    )


# ─── Criterion 2: PUT upserts; a second PUT updates in place ──────────────


def test_first_put_creates_the_cadence(client: TestClient) -> None:
    r = _put_cadence(client, "piece", "bach-invention-1", 7)
    assert r.status_code == 201
    body = r.json()
    assert body["subjectKind"] == "piece"
    assert body["subjectId"] == "bach-invention-1"
    assert body["intervalDays"] == 7


def test_second_put_updates_in_place_not_a_second_row(client: TestClient) -> None:
    first = _put_cadence(client, "piece", "bach-invention-1", 7)
    assert first.status_code == 201
    cadence_id = first.json()["id"]

    second = _put_cadence(client, "piece", "bach-invention-1", 14)
    assert second.status_code == 200
    body = second.json()
    # Same row, updated value — not a new id.
    assert body["id"] == cadence_id
    assert body["intervalDays"] == 14

    # Exactly one row for this subject, not two.
    items = client.get("/v1/recording-cadences").json()
    matching = [
        c for c in items if c["subjectKind"] == "piece" and c["subjectId"] == "bach-invention-1"
    ]
    assert len(matching) == 1
    assert matching[0]["intervalDays"] == 14


def test_repeated_off_does_not_accumulate_rows(client: TestClient) -> None:
    _put_cadence(client, "scale", "c-major", 3)
    off1 = _put_cadence(client, "scale", "c-major", None)
    assert off1.status_code == 200
    assert off1.json()["intervalDays"] is None
    # Turning "off" off-and-on-again (here: off twice) must not create rows.
    off2 = _put_cadence(client, "scale", "c-major", None)
    assert off2.status_code == 200
    assert off2.json()["id"] == off1.json()["id"]

    items = client.get("/v1/recording-cadences").json()
    matching = [c for c in items if c["subjectKind"] == "scale" and c["subjectId"] == "c-major"]
    assert len(matching) == 1


def test_different_subjects_get_independent_rows(client: TestClient) -> None:
    _put_cadence(client, "piece", "p1", 7)
    _put_cadence(client, "piece", "p2", 14)

    items = client.get("/v1/recording-cadences").json()
    by_subject = {c["subjectId"]: c["intervalDays"] for c in items}
    assert by_subject["p1"] == 7
    assert by_subject["p2"] == 14


# ─── Validation ─────────────────────────────────────────────────────────


def test_zero_interval_is_422_off_is_null_not_zero(client: TestClient) -> None:
    r = _put_cadence(client, "piece", "p1", 0)
    assert r.status_code == 422


def test_negative_interval_is_422(client: TestClient) -> None:
    r = _put_cadence(client, "piece", "p1", -3)
    assert r.status_code == 422


# ─── GET list ───────────────────────────────────────────────────────────


def test_list_is_empty_with_no_cadences_set(client: TestClient) -> None:
    assert client.get("/v1/recording-cadences").json() == []
