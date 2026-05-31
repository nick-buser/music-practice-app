"""OpenTelemetry → SigNoz, wired only when configured.

Kept lazy and guarded: the OTel packages live in the optional `otel` dependency
group, and tracing turns on only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. The
app runs identically with no collector in front of it (and the test suite needs
none of these imports).
"""
# The OTel packages are an optional dependency group and ship loose type info,
# so type-checking this lazily-imported module isn't worth the noise.
# pyright: reportMissingImports=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false

from __future__ import annotations

import structlog
from fastapi import FastAPI
from sqlalchemy import Engine

from app.config import settings

log = structlog.get_logger()


def configure_observability(app: FastAPI, engine: Engine) -> None:
    if not settings.otel_exporter_otlp_endpoint:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        log.warning("otel_packages_missing", hint="install the 'otel' dependency group")
        return

    provider = TracerProvider(resource=Resource.create({"service.name": settings.service_name}))
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint))
    )
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine)
    log.info("otel_enabled", endpoint=settings.otel_exporter_otlp_endpoint)
