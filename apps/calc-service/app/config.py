"""Module-level constants for the calc-service.

`SERVICE_VERSION` is the single source of truth — surfaced in /health,
all calculation responses' `service_version` field, and the Pino-shaped
logger metadata. Bump this in lockstep with `pyproject.toml`.
"""

from __future__ import annotations

import os

SERVICE_VERSION = "0.0.1"
SERVICE_NAME = "cems-calc-service"
ENV = os.environ.get("CEMS_ENV", "development")
