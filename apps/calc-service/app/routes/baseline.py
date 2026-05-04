"""POST /calculate/baseline — energy baseline regression stub route.

Returns a deterministic placeholder response. Real math lands in Story 8.2.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.config import SERVICE_VERSION
from app.models.baseline import BaselineCoeffs, BaselineRequest, BaselineResponse

router = APIRouter()


@router.post("/calculate/baseline", response_model=BaselineResponse)
def calculate_baseline(request: BaselineRequest) -> BaselineResponse:
    return BaselineResponse(
        audit_id=request.audit_id,
        r_squared=0.0,
        coefficients=BaselineCoeffs(intercept=0.0, cdd_slope=0.0, hdd_slope=0.0),
        predicted_baseline_kwh=0.0,
        service_version=SERVICE_VERSION,
        calculated_at=datetime.now(timezone.utc),
    )
