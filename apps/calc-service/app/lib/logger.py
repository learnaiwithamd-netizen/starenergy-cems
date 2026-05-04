"""Structured JSON logger for the calc-service.

Field names mirror the Node API's Pino logger (Story 0.4) so cross-service
Application Insights queries work uniformly:
  service, env, request_id, route, method, status_code, duration_ms.

Sensitive keys (password / secret / token / api[_-]?key) are scrubbed before
serialization. Configure via `setup_logger()`; call once at process boot.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from pythonjsonlogger import jsonlogger

from app.config import ENV, SERVICE_NAME

_REDACT_PATTERN = re.compile(r"(password|secret|token|api[_-]?key)", re.IGNORECASE)


class CemsJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        super().add_fields(log_record, record, message_dict)
        # Pino-shape field names.
        log_record.setdefault("service", SERVICE_NAME)
        log_record.setdefault("env", ENV)
        log_record["level"] = record.levelname.lower()
        log_record["msg"] = log_record.pop("message", record.getMessage())
        # Time field gets ISO-8601 in Z form via `timestamp=True` in formatter init.
        _redact_in_place(log_record)


def _redact_in_place(obj: Any) -> None:
    if isinstance(obj, dict):
        for key in list(obj.keys()):
            if isinstance(key, str) and _REDACT_PATTERN.search(key):
                obj[key] = "[REDACTED]"
            else:
                _redact_in_place(obj[key])
    elif isinstance(obj, list):
        for item in obj:
            _redact_in_place(item)


_configured = False


def setup_logger() -> logging.Logger:
    """Idempotent logger setup. Safe to call multiple times (tests do)."""
    global _configured
    logger = logging.getLogger(SERVICE_NAME)
    if _configured:
        return logger

    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    if level_name not in valid_levels:
        level_name = "INFO"
    logger.setLevel(level_name)
    logger.propagate = False

    handler = logging.StreamHandler()
    formatter = CemsJsonFormatter(
        "%(asctime)s %(level)s %(name)s %(message)s",
        timestamp=True,
        rename_fields={"asctime": "time"},
    )
    handler.setFormatter(formatter)

    # Replace any pre-existing handlers (test reloads, uvicorn child workers).
    logger.handlers = [handler]
    _configured = True
    return logger


def get_logger() -> logging.Logger:
    return setup_logger()
