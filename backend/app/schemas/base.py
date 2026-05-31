"""Base model: camelCase on the wire, snake_case in Python.

The SPA speaks camelCase (rootOctave, doubleRoot, createdAt…), so every schema
serialises with camelCase aliases while the Python code stays snake_case. This
is what lets the committed openapi.json generate a clean TS client.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
