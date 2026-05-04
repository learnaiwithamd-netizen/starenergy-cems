from fastapi.testclient import TestClient

from app.config import SERVICE_VERSION
from app.main import app
from app.models.ecm import EcmResponse

client = TestClient(app)


def _valid_payload() -> dict:
    return {
        "audit_id": "audit-123",
        "compressors": [
            {
                "compressor_id": "C1",
                "rack_id": "R1",
                "horsepower": 5.0,
                "refrigerant_type": "R-404A",
            }
        ],
        "weather_coefficients": {
            "avg_outdoor_temp_f": 55.0,
            "cooling_degree_days": 1200.0,
            "heating_degree_days": 4000.0,
        },
        "utility_rate_kwh": 0.12,
        "form_version": "v1",
    }


def test_ecm_happy_path_returns_valid_response() -> None:
    response = client.post("/calculate/ecm", json=_valid_payload())
    assert response.status_code == 200
    body = response.json()
    parsed = EcmResponse.model_validate(body)
    assert parsed.audit_id == "audit-123"
    assert parsed.total_savings_kwh == 0.0
    assert parsed.line_items == []
    assert parsed.service_version == SERVICE_VERSION


def test_ecm_missing_audit_id_returns_422_problem_detail() -> None:
    payload = _valid_payload()
    payload.pop("audit_id")
    response = client.post("/calculate/ecm", json=payload)
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["type"] == "https://cems.starenergy.ca/errors/validation-error"
    assert body["status"] == 422
    assert body["instance"] == "/calculate/ecm"
    assert any(err["field"].endswith("audit_id") for err in body["errors"])
