from fastapi.testclient import TestClient

from app.config import SERVICE_VERSION
from app.main import app

client = TestClient(app)


def test_health_returns_ok_with_version() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": SERVICE_VERSION}
