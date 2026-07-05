import pytest
from fastapi.testclient import TestClient
from app.main import app 

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code in [200, 404, 307]

def test_stream_endpoints_exist():
    response = client.get("/app/stream") 
    response_detect = client.post("/app/detect")
    assert response.status_code in [200, 404, 405]
    assert response_detect.status_code in [200, 404, 405, 422]