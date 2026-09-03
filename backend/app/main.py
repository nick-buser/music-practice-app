"""FastAPI application factory.

Wires the lifespan-managed DB, CORS for the SPA, a request-id correlation
middleware, problem+json error handling, optional OpenTelemetry, and the
versioned routers.
"""

from __future__ import annotations

import threading
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint

from app.config import settings
from app.db import SessionLocal, engine
from app.errors import install_error_handlers
from app.jobs.worker import run_forever
from app.logging import configure_logging
from app.models import Base
from app.observability import configure_observability
from app.openapi import use_problem_json_errors
from app.routers import api_router, health_router
from app.seed import ensure_default_user

configure_logging()
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    # Prod owns its schema via Alembic; dev/test bootstrap tables directly.
    if settings.env != "prod":
        Base.metadata.create_all(engine)
    with SessionLocal() as session:
        ensure_default_user(session)
    if settings.worker_embedded:
        # Daemon: never blocks process shutdown (no join on exit — the
        # thread just dies with the interpreter), and a crash inside
        # `run_forever` ends this thread alone, not the request-serving
        # process. Safe as *the* worker today because exactly one api
        # replica runs in-cluster (PV2); a separate worker Deployment is
        # later gitops work, if ever needed — see app/jobs/worker.py.
        threading.Thread(target=run_forever, name="job-worker", daemon=True).start()
        log.info("worker_thread_started", poll_seconds=settings.worker_poll_seconds)
    log.info("startup", env=settings.env, service=settings.service_name)
    yield
    engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(title="Soundings API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id(request: Request, call_next: RequestResponseEndpoint) -> Response:
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(request_id=rid)
        try:
            response = await call_next(request)
        finally:
            structlog.contextvars.clear_contextvars()
        response.headers["x-request-id"] = rid
        return response

    install_error_handlers(app)
    configure_observability(app, engine)

    app.include_router(health_router)
    app.include_router(api_router)
    use_problem_json_errors(app)
    return app


app = create_app()
