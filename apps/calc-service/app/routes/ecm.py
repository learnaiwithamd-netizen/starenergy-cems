"""POST /calculate/ecm — ECM savings stub route.

Returns a deterministic placeholder response. Real math lands in Story 8.1.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.config import SERVICE_VERSION
from app.models.ecm import EcmRequest, EcmResponse

router = APIRouter()


@router.post("/calculate/ecm", response_model=EcmResponse)
def calculate_ecm(request: EcmRequest) -> EcmResponse:
    return EcmResponse(
        audit_id=request.audit_id,
        total_savings_kwh=0.0,
        total_savings_dollars=0.0,
        line_items=[],
        service_version=SERVICE_VERSION,
        calculated_at=datetime.now(timezone.utc),
    )
