"""A single error shape for the whole API: RFC 9457 problem+json.

Routers raise `ProblemException` (or plain HTTPException); these handlers render
every error — including validation and uncaught failures — as problem+json, so
clients only ever parse one error format.
"""

from __future__ import annotations

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.common import Problem

PROBLEM_CONTENT_TYPE = "application/problem+json"
log = structlog.get_logger()


class ProblemException(Exception):
    def __init__(
        self, status: int, title: str, detail: str | None = None, type: str = "about:blank"
    ) -> None:
        self.problem = Problem(status=status, title=title, detail=detail, type=type)
        super().__init__(title)


def not_found(resource: str) -> ProblemException:
    return ProblemException(status=404, title=f"{resource} not found")


def _render(problem: Problem, request: Request) -> JSONResponse:
    if problem.instance is None:
        problem.instance = request.url.path
    return JSONResponse(
        status_code=problem.status,
        content=problem.model_dump(by_alias=True),
        media_type=PROBLEM_CONTENT_TYPE,
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProblemException)
    async def _problem(request: Request, exc: ProblemException) -> JSONResponse:
        return _render(exc.problem, request)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _render(Problem(status=exc.status_code, title=str(exc.detail)), request)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return _render(
            Problem(status=422, title="Validation error", detail=str(exc.errors())), request
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", path=request.url.path)
        return _render(Problem(status=500, title="Internal server error"), request)
