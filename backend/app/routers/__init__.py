"""Router assembly: health at the root, resources under /v1."""

from fastapi import APIRouter

from app.routers.chords import router as chords_router
from app.routers.health import router as health_router
from app.routers.provenance import router as provenance_router
from app.routers.sessions import router as sessions_router

api_router = APIRouter(prefix="/v1")
api_router.include_router(chords_router)
api_router.include_router(provenance_router)
api_router.include_router(sessions_router)

__all__ = ["api_router", "health_router"]
