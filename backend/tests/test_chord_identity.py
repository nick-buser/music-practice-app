"""The `ChordIdentity` schema — the server-owned canonical shape."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.chord_identity import ChordIdentity


def test_parses_camelcase_with_defaults() -> None:
    c = ChordIdentity.model_validate(
        {
            "root": {"letter": "C", "accidental": "natural"},
            "quality": "major",
            "seventh": "min7",
            "extensions": [7, 9],
            "alterations": [{"degree": 9, "change": "b"}],
            "voicing": {"type": "drop2", "inversion": 0, "rootOctave": 4, "doubleRoot": False},
        }
    )
    assert c.voicing.root_octave == 4  # snake_case in Python
    assert c.voicing.double_root is False
    assert c.alterations[0].degree == 9


def test_round_trips_to_camelcase_json() -> None:
    c = ChordIdentity.model_validate(
        {
            "root": {"letter": "A", "accidental": "flat"},
            "quality": "minor",
            "voicing": {"type": "block", "inversion": 1, "rootOctave": 4},
        }
    )
    dumped = c.model_dump(by_alias=True)
    assert dumped["voicing"]["rootOctave"] == 4
    assert dumped["voicing"]["doubleRoot"] is False  # default surfaced
    assert dumped["root"]["accidental"] == "flat"


def test_rejects_unknown_quality() -> None:
    with pytest.raises(ValidationError):
        ChordIdentity.model_validate(
            {
                "root": {"letter": "C", "accidental": "natural"},
                "quality": "augmented-major-weird",
                "voicing": {"type": "block", "inversion": 0, "rootOctave": 4},
            }
        )


def test_rejects_out_of_range_inversion() -> None:
    with pytest.raises(ValidationError):
        ChordIdentity.model_validate(
            {
                "root": {"letter": "C", "accidental": "natural"},
                "quality": "major",
                "voicing": {"type": "block", "inversion": 7, "rootOctave": 4},
            }
        )
