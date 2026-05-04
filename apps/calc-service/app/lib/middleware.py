"""Per-request structured access log middleware.

Generates a UUID request_id, propagates via `request.state.request_id`,
and emits one info log line per response with the same field names as
the Node API's Pino access log (Story 0.4): request_id, route, method,
status_code, duration_ms.
"""

from __future__ import annotations

import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.lib.logger import get_logger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Honor an upstream-generated request id (Node API + any future
        # gateway). Falls back to a fresh UUID when there's no inbound
        # correlation token. Cross-service traces stay glued together.
        inbound = request.headers.get("x-request-id")
        request_id = inbound if inbound and len(inbound) <= 128 else uuid4().hex
        request.state.request_id = request_id
        start_ns = time.perf_counter_ns()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter_ns() - start_ns) / 1_000_000
            get_logger().error(
                "request errored",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "route": request.url.path,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                },
            )
            raise

        duration_ms = (time.perf_counter_ns() - start_ns) / 1_000_000
        response.headers["x-request-id"] = request_id
        get_logger().info(
            "request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "route": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response
