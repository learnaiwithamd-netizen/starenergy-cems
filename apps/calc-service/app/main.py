from __future__ import annotations

from fastapi import FastAPI

from app.config import SERVICE_VERSION
from app.lib.error_handler import register_error_handlers
from app.lib.middleware import RequestLoggingMiddleware
from app.routes import baseline, ecm, refrigerant

app = FastAPI(title="CEMS Calculation Service", version=SERVICE_VERSION)

app.add_middleware(RequestLoggingMiddleware)
register_error_handlers(app)

app.include_router(ecm.router)
app.include_router(baseline.router)
app.include_router(refrigerant.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": SERVICE_VERSION}
