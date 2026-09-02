"""Import every model so Alembic autogenerate and `Base.metadata` see them all."""

from app.models.base import Base
from app.models.chord import SavedChord
from app.models.idea import Idea, IdeaAsset, IdeaLink
from app.models.provenance import ExtractedProperty, ExtractionRun
from app.models.session import PracticeSession
from app.models.user import DEFAULT_USER_ID, User

__all__ = [
    "DEFAULT_USER_ID",
    "Base",
    "ExtractedProperty",
    "ExtractionRun",
    "Idea",
    "IdeaAsset",
    "IdeaLink",
    "PracticeSession",
    "SavedChord",
    "User",
]
