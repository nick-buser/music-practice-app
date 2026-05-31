"""structlog setup — JSON logs in prod, readable console logs in dev."""

from __future__ import annotations

import logging

import structlog

from app.config import settings


def configure_logging() -> None:
    renderer = (
        structlog.dev.ConsoleRenderer()
        if settings.env == "dev"
        else structlog.processors.JSONRenderer()
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )
