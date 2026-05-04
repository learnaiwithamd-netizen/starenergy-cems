"""ECM (Energy Conservation Measure) calculation request/response models.

PARITY: TypeScript Zod mirrors live in apps/api/src/lib/calc-service-schemas.ts.
Any field change here REQUIRES a matching update there. Story 0.6 will
auto-generate the Zod schemas from FastAPI's /openapi.json.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CompressorSpec(BaseModel):
    compressor_id: str = Field(min_length=1)
    rack_id: str = Field(min_length=1)
    horsepower: float = Field(gt=0)
    refrigerant_type: str = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


class WeatherCoeffs(BaseModel):
    avg_outdoor_temp_f: float
    cooling_degree_days: float = Field(ge=0)
    heating_degree_days: float = Field(ge=0)

    model_config = ConfigDict(extra="forbid")


class EcmRequest(BaseModel):
    audit_id: str = Field(min_length=1)
    compressors: list[CompressorSpec] = Field(min_length=0)
    weather_coefficients: WeatherCoeffs
    utility_rate_kwh: float = Field(gt=0)
    form_version: str = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


class EcmLineItem(BaseModel):
    equipment_type: Literal["compressor", "rack", "condenser"]
    equipment_id: str = Field(min_length=1)
    measure: Literal["floating-suction", "head-pressure-control"]
    savings_kwh: float = Field(ge=0)
    savings_dollars: float = Field(ge=0)

    model_config = ConfigDict(extra="forbid")


class EcmResponse(BaseModel):
    audit_id: str
    total_savings_kwh: float = Field(ge=0)
    total_savings_dollars: float = Field(ge=0)
    line_items: list[EcmLineItem]
    service_version: str
    calculated_at: datetime

    model_config = ConfigDict(extra="forbid")
