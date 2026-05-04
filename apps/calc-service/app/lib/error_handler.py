"""RFC 7807 Problem Details error handlers.

Mirrors the Node API's error contract (Story 0.4 § RFC 7807) so callers
parse a single shape across services. Stack traces are logged, never
returned in the response body.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

STATUS_TO_SLUG: dict[int, str] = {
    400: "bad-request",
    401: "authentication-required",
    403: "forbidden",
    404: "not-found",
    409: "conflict",
    413: "payload-too-large",
    422: "validation-error",
    500: "internal-error",
    503: "service-unavailable",
}

STATUS_TO_TITLE: dict[int, str] = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    413: "Payload Too Large",
    422: "Validation Failed",
    500: "Internal Server Error",
    503: "Service Unavailable",
}

ERROR_TYPE_BASE = "https://cems.starenergy.ca/errors"
PROBLEM_JSON = "application/problem+json"

logger = logging.getLogger("cems-calc-service")


def _problem(
    *,
    status: int,
    slug: str,
    title: str,
    detail: str,
    instance: str,
    errors: list[dict[str, str]] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": f"{ERROR_TYPE_BASE}/{slug}",
        "title": title,
        "status": status,
        "detail": detail,
        "instance": instance,
    }
    if errors is not None:
        body["errors"] = errors
    return JSONResponse(status_code=status, content=body, media_type=PROBLEM_JSON)


def _format_field(loc: tuple) -> str:
    """Render a Pydantic loc tuple as the RFC 7807 `field` value.

    Pydantic v2 prefixes body-field locs with `'body'` (e.g. `('body', 'audit_id')`).
    Strip that prefix so the `field` matches the Node API's RFC 7807 contract
    (Story 0.4) — clients see `audit_id`, not `body.audit_id`.
    """
    parts = [str(p) for p in loc]
    if parts and parts[0] == "body":
        parts = parts[1:]
    return ".".join(parts) or "(root)"


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = [
        {
            "field": _format_field(err.get("loc", ())),
            "message": str(err.get("msg", "")),
        }
        for err in exc.errors()
    ]
    return _problem(
        status=422,
        slug="validation-error",
        title="Validation Failed",
        detail="Request body validation failed",
        instance=request.url.path,
        errors=errors,
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Translate intentional Starlette/FastAPI HTTPExceptions to RFC 7807.

    Future calc routes (Story 8) may raise `HTTPException(404)` for missing
    audit data or `HTTPException(409)` for state conflicts. Without this
    handler, the catch-all `Exception` handler below would rewrite them as
    500 internal errors.
    """
    status = exc.status_code
    slug = STATUS_TO_SLUG.get(status, "internal-error")
    title = STATUS_TO_TITLE.get(status, "Error")
    # `detail` may be a string or arbitrary JSON-serialisable object on
    # FastAPI's HTTPException; coerce safely.
    raw_detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return _problem(
        status=status,
        slug=slug,
        title=title,
        detail=raw_detail,
        instance=request.url.path,
    )


async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    logger.error(
        "unhandled exception",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "method": request.method,
            "err": repr(exc),
        },
        exc_info=True,
    )
    return _problem(
        status=500,
        slug="internal-error",
        title="Internal Server Error",
        detail="Internal server error",
        instance=request.url.path,
    )


def register_error_handlers(app: FastAPI) -> None:
    # Order: most specific first. Starlette dispatches the matching handler
    # by exception class; the `Exception` catch-all only fires for
    # exceptions that no other handler claims.
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
