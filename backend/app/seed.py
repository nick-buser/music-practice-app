"""Idempotent seeding of the single default user.

Runs at startup (and in tests) so the app is usable without a manual step. The
canonical insert also lives in the initial migration; this is the defensive
belt-and-braces that keeps dev/test green.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import DEFAULT_USER_ID, User


def ensure_default_user(session: Session) -> None:
    if session.get(User, DEFAULT_USER_ID) is None:
        session.add(User(id=DEFAULT_USER_ID, display_name="Default User"))
        session.commit()
