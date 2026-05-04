from fastapi.testclient import TestClient

from app.config import SERVICE_VERSION
from app.main import app
from app.models.baseline import BaselineResponse

client = TestClient(app)


def _valid_payload() -> dict:
    return {
        "audit_id": "audit-456",
        "monthly_consumption": [
            {"year": 2025, "month": 1, "consumption_kwh": 1000.0},
            {"year": 2025, "month": 2, "consumption_kwh": 950.0},
        ],
        "cdd_hdd_data": [
            {"year": 2025, "month": 1, "cdd": 0.0, "hdd": 800.0},
            {"year": 2025, "month": 2, "cdd": 0.0, "hdd": 700.0},
        ],
    }


def test_baseline_happy_path_returns_valid_response() -> None:
    response = client.post("/calculate/baseline", json=_valid_payload())
    assert response.status_code == 200
    parsed = BaselineResponse.model_validate(response.json())
    assert parsed.audit_id == "audit-456"
    assert parsed.r_squared == 0.0
    assert parsed.coefficients.intercept == 0.0
    assert parsed.service_version == SERVICE_VERSION


def test_baseline_invalid_regression_method_returns_422() -> None:
    payload = _valid_payload()
    payload["regression_method"] = "not-a-real-method"
    response = client.post("/calculate/baseline", json=payload)
    assert response.status_code == 422
    body = response.json()
    assert body["type"] == "https://cems.starenergy.ca/errors/validation-error"
    assert body["instance"] == "/calculate/baseline"
