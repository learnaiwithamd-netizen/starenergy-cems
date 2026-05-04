"""Refrigerant temperature-to-pressure conversion request/response models.

PARITY: TypeScript Zod mirrors live in apps/api/src/lib/calc-service-schemas.ts.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RefrigerantType = Literal[
    "R-404A", "R-407A", "R-448A", "R-449A", "R-507A", "R-22"
]


class RefrigerantRequest(BaseModel):
    refrigerant_type: RefrigerantType
    temperature_f: float = Field(ge=-100, le=200)

    model_config = ConfigDict(extra="forbid")


class RefrigerantResponse(BaseModel):
    refrigerant_type: str
    temperature_f: float
    pressure_psig: float
    service_version: str
    calculated_at: datetime

    model_config = ConfigDict(extra="forbid")
