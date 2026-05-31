"""Cross-cutting wire types: pagination envelope and RFC 9457 problem details."""

from __future__ import annotations

from app.schemas.base import CamelModel


class Page[T](CamelModel):
    items: list[T]
    total: int
    limit: int
    offset: int


class Problem(CamelModel):
    """RFC 9457 (problem+json) error body."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
