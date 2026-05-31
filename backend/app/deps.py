"""Request dependencies — including the auth seam.

`get_current_user` is the single place tenancy is decided. Today it returns the
seeded default user; swapping it for token verification is what turns on real
auth/multi-tenancy. Because every owned query already filters by `user_id`, no
endpoint or model changes when that day comes.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import DEFAULT_USER_ID


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID


def get_current_user() -> CurrentUser:
    # Single-tenant: always the default user. → multi-tenant: decode a token here.
    return CurrentUser(id=DEFAULT_USER_ID)


@dataclass(frozen=True)
class PageParams:
    limit: int
    offset: int


def page_params(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    # Bounded so an absurd offset can't overflow the DB integer (→ 422, not 500).
    offset: Annotated[int, Query(ge=0, le=1_000_000)] = 0,
) -> PageParams:
    return PageParams(limit=limit, offset=offset)


DbSession = Annotated[Session, Depends(get_db)]
CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
PageParamsDep = Annotated[PageParams, Depends(page_params)]
