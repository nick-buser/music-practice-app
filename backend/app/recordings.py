"""Shared vocabulary for the recordings API: `RecordingTrackKind`, imported
by both `app/models/recording.py` and `app/schemas/recording.py` — the same
split `app/links.py` and `app/provenance.py` use for their own domains (see
`app/models/idea.py`'s module docstring: schemas never import from
`app/models/` in this codebase, so a shared non-model module is where a type
used by both has to live).
"""

from __future__ import annotations

from typing import Literal

# Backed by a plain `String` column with a `CheckConstraint` in
# `app/models/recording.py`, not a SQLAlchemy `Enum` — see that module's
# docstring (mirrors `app/models/provenance.py`'s reasoning).
RecordingTrackKind = Literal["audio", "midi"]
