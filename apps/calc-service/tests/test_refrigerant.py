from fastapi.testclient import TestClient

from app.config import SERVICE_VERSION
from app.main import app
from app.models.refrigerant import RefrigerantResponse

client = TestClient(app)


def test_refrigerant_happy_path_returns_valid_response() -> None:
    response = client.post(
        "/calculate/refrigerant",
        json={"refrigerant_type": "R-404A", "temperature_f": 40.0},
    )
    assert response.status_code == 200
    parsed = RefrigerantResponse.model_validate(response.json())
    assert parsed.refrigerant_type == "R-404A"
    assert parsed.temperature_f == 40.0
    assert parsed.pressure_psig == 0.0
    assert parsed.service_version == SERVICE_VERSION


def test_refrigerant_unsupported_type_returns_422() -> None:
    response = client.post(
        "/calculate/refrigerant",
        json={"refrigerant_type": "R-NOT-REAL", "temperature_f": 40.0},
    )
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")


def test_refrigerant_temperature_below_minimum_returns_422() -> None:
    response = client.post(
        "/calculate/refrigerant",
        json={"refrigerant_type": "R-404A", "temperature_f": -101.0},
    )
    assert response.status_code == 422


def test_refrigerant_temperature_at_upper_boundary_is_accepted() -> None:
    response = client.post(
        "/calculate/refrigerant",
        json={"refrigerant_type": "R-404A", "temperature_f": 200.0},
    )
    assert response.status_code == 200
