"""Energy baseline (CDD/HDD regression) request/response models.

PARITY: TypeScript Zod mirrors live in apps/api/src/lib/calc-service-schemas.ts.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MonthlyReading(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    consumption_kwh: float = Field(ge=0)

    model_config = ConfigDict(extra="forbid")


class DegreeDay(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    cdd: float = Field(ge=0)
    hdd: float = Field(ge=0)

    model_config = ConfigDict(extra="forbid")


class BaselineRequest(BaseModel):
    audit_id: str = Field(min_length=1)
    monthly_consumption: list[MonthlyReading] = Field(min_length=0)
    cdd_hdd_data: list[DegreeDay] = Field(min_length=0)
    regression_method: Literal["cdd-only", "hdd-only", "cdd-hdd"] = "cdd-hdd"

    model_config = ConfigDict(extra="forbid")


class BaselineCoeffs(BaseModel):
    intercept: float
    cdd_slope: float
    hdd_slope: float

    model_config = ConfigDict(extra="forbid")


class BaselineResponse(BaseModel):
    audit_id: str
    r_squared: float = Field(ge=0, le=1)
    coefficients: BaselineCoeffs
    predicted_baseline_kwh: float = Field(ge=0)
    service_version: str
    calculated_at: datetime

    model_config = ConfigDict(extra="forbid")
