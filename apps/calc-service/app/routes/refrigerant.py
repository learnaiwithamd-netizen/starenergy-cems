"""POST /calculate/refrigerant — refrigerant temp-to-pressure stub route.

Returns a deterministic placeholder response. Real lookup table lands in Story 8.3.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.config import SERVICE_VERSION
from app.models.refrigerant import RefrigerantRequest, RefrigerantResponse

router = APIRouter()


@router.post("/calculate/refrigerant", response_model=RefrigerantResponse)
def calculate_refrigerant(request: RefrigerantRequest) -> RefrigerantResponse:
    return RefrigerantResponse(
        refrigerant_type=request.refrigerant_type,
        temperature_f=request.temperature_f,
        pressure_psig=0.0,
        service_version=SERVICE_VERSION,
        calculated_at=datetime.now(timezone.utc),
    )
