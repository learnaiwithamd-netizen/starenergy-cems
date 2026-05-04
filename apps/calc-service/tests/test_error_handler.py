"""RFC 7807 error handler tests.

Validates that:
- Pydantic validation errors render as application/problem+json with errors[]
- Unknown fields (extra='forbid') trigger 422
- Unhandled handler-thrown exceptions render as 500 with no stack-trace leak
- Intentional HTTPException(status) preserves its status (404, 409, ...)
- Pydantic loc tuples drop the `body` prefix in the emitted `field`
- Inbound `x-request-id` is honored for cross-service tracing
"""

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.lib.error_handler import register_error_handlers
from app.lib.middleware import RequestLoggingMiddleware
from app.main import app

client = TestClient(app)


def test_validation_error_returns_problem_detail_with_errors_array() -> None:
    response = client.post("/calculate/ecm", json={})
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["type"] == "https://cems.starenergy.ca/errors/validation-error"
    assert body["title"] == "Validation Failed"
    assert body["status"] == 422
    assert body["detail"] == "Request body validation failed"
    assert isinstance(body["errors"], list)
    assert len(body["errors"]) > 0
    assert all("field" in e and "message" in e for e in body["errors"])


def test_unknown_field_rejected_under_extra_forbid() -> None:
    response = client.post(
        "/calculate/refrigerant",
        json={
            "refrigerant_type": "R-404A",
            "temperature_f": 40.0,
            "rogue_field": "should be rejected",
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert any("rogue_field" in e["field"] for e in body["errors"])


def test_validation_error_field_drops_body_prefix() -> None:
    """Pydantic loc tuples are `('body', '<field>')`; the RFC 7807 `field`
    must read as `<field>`, not `body.<field>`, for parity with the Node API."""
    response = client.post("/calculate/ecm", json={})
    body = response.json()
    fields = [e["field"] for e in body["errors"]]
    # No emitted field should start with `body.` after the strip.
    assert not any(f.startswith("body.") for f in fields), fields
    # And at least one should match a known model field name directly.
    assert any(f == "audit_id" for f in fields), fields


def test_http_exception_preserves_status_code_via_dedicated_handler() -> None:
    """Story 8 will raise HTTPException(404) for missing audit data. Without
    a Starlette HTTPException handler, the catch-all `Exception` handler
    would rewrite that to a 500."""
    fault_app = FastAPI()
    fault_app.add_middleware(RequestLoggingMiddleware)
    register_error_handlers(fault_app)

    @fault_app.get("/missing")
    def missing() -> None:
        raise HTTPException(status_code=404, detail="audit not found")

    @fault_app.get("/conflict")
    def conflict() -> None:
        raise HTTPException(status_code=409, detail="state conflict")

    fault_client = TestClient(fault_app)

    not_found = fault_client.get("/missing")
    assert not_found.status_code == 404
    assert not_found.headers["content-type"].startswith("application/problem+json")
    body = not_found.json()
    assert body["type"] == "https://cems.starenergy.ca/errors/not-found"
    assert body["title"] == "Not Found"
    assert body["detail"] == "audit not found"
    assert body["instance"] == "/missing"

    state_conflict = fault_client.get("/conflict")
    assert state_conflict.status_code == 409
    assert state_conflict.json()["type"] == "https://cems.starenergy.ca/errors/conflict"


def test_inbound_x_request_id_is_honored_for_cross_service_tracing() -> None:
    """Story 0.5 cross-service tracing requires the calc-service to keep
    the upstream request id intact when present."""
    upstream_id = "deadbeef" * 4
    response = client.get("/health", headers={"x-request-id": upstream_id})
    assert response.status_code == 200
    assert response.headers["x-request-id"] == upstream_id


def test_unhandled_exception_renders_500_problem_detail_without_stack() -> None:
    fault_app = FastAPI()
    fault_app.add_middleware(RequestLoggingMiddleware)
    register_error_handlers(fault_app)

    @fault_app.get("/boom")
    def boom() -> None:
        raise RuntimeError("dev secret token leak should NOT appear in body")

    fault_client = TestClient(fault_app, raise_server_exceptions=False)
    response = fault_client.get("/boom")
    assert response.status_code == 500
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["type"] == "https://cems.starenergy.ca/errors/internal-error"
    assert body["status"] == 500
    assert body["detail"] == "Internal server error"
    # Critical: the exception message must NOT leak into the response body.
    assert "secret token" not in response.text
    assert "RuntimeError" not in response.text
