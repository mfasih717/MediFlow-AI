# -*- coding: utf-8 -*-
"""MediFlow AI - Comprehensive API Endpoint Test Suite
Tests root, health, AMD ROCm telemetry, bilingual chat, timeline, and ingestion endpoints.
"""

import io
import pytest
import httpx
from app.main import app

BASE_URL = "http://127.0.0.1:8080"


@pytest.fixture
def client():
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url=BASE_URL)


@pytest.mark.asyncio
async def test_root_endpoint(client: httpx.AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "MediFlow AI" in data["message"]
    assert data["port"] == 8080
    assert data["api_v1"] == "/api/v1"


@pytest.mark.asyncio
async def test_health_liveness_endpoint(client: httpx.AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "MediFlow AI"


@pytest.mark.asyncio
async def test_api_v1_health(client: httpx.AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["app_name"] == "MediFlow AI"
    assert data["amd_gpu"]["gpu_available"] is True
    assert "vllm_engine" in data


@pytest.mark.asyncio
async def test_api_v1_health_amd_rocm(client: httpx.AsyncClient):
    response = await client.get("/api/v1/health/amd-rocm")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert len(data["devices"]) >= 1
    assert data["zero_phi_enforcement"]["local_compute_isolated"] is True


@pytest.mark.asyncio
async def test_chat_tier3_emergency_english(client: httpx.AsyncClient):
    payload = {
        "message": "Patient experiencing severe crushing chest pain radiating to left arm and sweating",
        "language_preference": "en",
        "patient_id": "test-patient-001",
    }
    response = await client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["triage_tier"] == "tier_3_acute_emergency"
    assert data["is_emergency"] is True
    assert data["emergency_contact"] == "1122"
    assert len(data["red_flag_findings"]) >= 1


@pytest.mark.asyncio
async def test_chat_tier3_emergency_urdu_nastaliq(client: httpx.AsyncClient):
    payload = {
        "message": "سینے میں شدید درد اور سانس لینے میں دشواری ہے",
        "language_preference": "ur",
    }
    response = await client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["triage_tier"] == "tier_3_acute_emergency"
    assert data["is_emergency"] is True


@pytest.mark.asyncio
async def test_chat_tier3_emergency_roman_urdu(client: httpx.AsyncClient):
    payload = {
        "message": "Seene me dard aur paseena araha hai bohot zyada",
        "language_preference": "mixed",
    }
    response = await client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["triage_tier"] == "tier_3_acute_emergency"
    assert data["is_emergency"] is True


@pytest.mark.asyncio
async def test_chat_tier2_ambiguity(client: httpx.AsyncClient):
    payload = {
        "message": "Doctor ne parchi pe likha hai lkn dose samajh nahi arahi blurry unreadable",
        "language_preference": "mixed",
    }
    response = await client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["triage_tier"] == "tier_2_ambiguous"
    assert data["clarification_required"] is True
    assert data["is_emergency"] is False


@pytest.mark.asyncio
async def test_chat_tier1_routine(client: httpx.AsyncClient):
    payload = {
        "message": "Take Paracetamol 500mg 1 tablet after meals twice daily for 3 days",
        "language_preference": "en",
    }
    response = await client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["triage_tier"] == "tier_1_routine"
    assert data["is_emergency"] is False
    assert data["clarification_required"] is False
    assert "reply_english" in data
    assert "reply_urdu" in data


@pytest.mark.asyncio
async def test_chat_validation_max_length(client: httpx.AsyncClient):
    huge_message = "A" * 4001
    payload = {
        "message": huge_message,
        "language_preference": "en",
    }
    response = await client.post("/api/v1/chat", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_timeline_daily(client: httpx.AsyncClient):
    response = await client.get("/api/v1/timeline/daily/demo-patient-001")
    assert response.status_code == 200
    data = response.json()
    assert data["patient_id"] == "demo-patient-001"
    assert "doses" in data
    assert data["total_doses"] >= 1
    assert "adherence_percentage" in data


@pytest.mark.asyncio
async def test_timeline_dose_status_update(client: httpx.AsyncClient):
    payload = {"status": "taken"}
    response = await client.post(
        "/api/v1/timeline/dose/demo-patient-001/dose-demo-01/status",
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["new_status"] == "taken"
    assert data["dose_id"] == "dose-demo-01"


@pytest.mark.asyncio
async def test_ingestion_disallowed_extension(client: httpx.AsyncClient):
    files = {"file": ("malicious_script.sh", b"echo 'hack'", "text/x-shellscript")}
    response = await client.post("/api/v1/ingestion/upload", files=files)
    assert response.status_code == 415


@pytest.mark.asyncio
async def test_ingestion_magic_byte_mismatch(client: httpx.AsyncClient):
    files = {"file": ("fake_prescription.pdf", b"This is plain text pretending to be PDF", "application/pdf")}
    response = await client.post("/api/v1/ingestion/upload", files=files)
    assert response.status_code == 415


@pytest.mark.asyncio
async def test_ingestion_valid_minimal_pdf(client: httpx.AsyncClient):
    # Minimal valid PDF header and trailer
    minimal_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF\n"
    )
    files = {"file": ("test_prescription.pdf", minimal_pdf, "application/pdf")}
    response = await client.post("/api/v1/ingestion/upload", files=files)
    assert response.status_code == 201
    data = response.json()
    assert "document_id" in data
    assert "triage_tier" in data
    assert data["filename"] == "test_prescription.pdf"
