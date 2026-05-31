"""Make the generated OpenAPI tell the truth about errors.

Every endpoint can return an RFC 9457 `application/problem+json` body (404 on
missing resources, 422 on bad input), but FastAPI's default schema documents
errors as `application/json`. Reflecting the real shape keeps the contract
honest — schemathesis conformance passes, and the generated TS client knows the
error type.
"""

# This module stitches raw OpenAPI dicts (typed as Any by FastAPI), so the
# "unknown type" diagnostics are noise here.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from app.schemas.common import Problem

_METHODS = ("get", "post", "put", "patch", "delete")


def use_problem_json_errors(app: FastAPI) -> None:
    def openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
        schemas = schema.setdefault("components", {}).setdefault("schemas", {})
        schemas["Problem"] = Problem.model_json_schema()
        error_response = {
            "description": "Error (problem+json)",
            "content": {
                "application/problem+json": {"schema": {"$ref": "#/components/schemas/Problem"}}
            },
        }
        for path_item in schema["paths"].values():
            for method in _METHODS:
                operation = path_item.get(method)
                if operation is None:
                    continue
                responses = operation.setdefault("responses", {})
                responses["404"] = error_response
                responses["422"] = error_response
        app.openapi_schema = schema
        return schema

    app.openapi = openapi  # type: ignore[method-assign]
