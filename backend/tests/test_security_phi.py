# -*- coding: utf-8 -*-
"""MediFlow AI - Unit Tests for PHI Sanitization & Hardware Isolation Security
Tests CNIC redaction, phone masking, email sanitization, and local AMD host enforcement.
"""

import pytest
from app.core.security import (
    anonymize_text_for_llm,
    assert_local_amd_environment,
    create_access_token,
    verify_token,
    hash_patient_identifier,
)


def test_cnic_anonymization_hyphenated():
    text = "Patient CNIC is 35201-1234567-1 recorded in file."
    sanitized = anonymize_text_for_llm(text)
    assert "35201-1234567-1" not in sanitized
    assert "[PATIENT_ID_REDACTED]" in sanitized


def test_cnic_anonymization_unhyphenated():
    text = "Patient identity 3520112345671 presented at desk."
    sanitized = anonymize_text_for_llm(text)
    assert "3520112345671" not in sanitized
    assert "[PATIENT_ID_REDACTED]" in sanitized


def test_phone_number_anonymization():
    texts = [
        "Contact family at 0300-1234567 immediately",
        "WhatsApp number +923001234567",
        "Phone: 0321 7654321",
    ]
    for t in texts:
        sanitized = anonymize_text_for_llm(t)
        assert "1234567" not in sanitized or "7654321" not in sanitized
        assert "[PHONE_REDACTED]" in sanitized


def test_email_anonymization():
    text = "Send medical summary to doctor.ahmed@hospital.org.pk for review."
    sanitized = anonymize_text_for_llm(text)
    assert "doctor.ahmed@hospital.org.pk" not in sanitized
    assert "[EMAIL_REDACTED]" in sanitized


def test_assert_local_amd_environment_allowed():
    allowed_endpoints = [
        "http://localhost:8000/v1",
        "http://127.0.0.1:8000/v1",
        "http://0.0.0.0:8000/v1",
        "http://192.168.1.100:8000/v1",
        "http://10.0.0.5:8000/v1",
        "http://172.16.0.10:8000/v1",
        "http://vllm.cluster.local:8000/v1",
        "http://rocm-node-01.internal:8000/v1",
    ]
    for ep in allowed_endpoints:
        assert assert_local_amd_environment(ep) is True


def test_assert_local_amd_environment_rejected_cloud_llms():
    forbidden_endpoints = [
        "https://api.openai.com/v1",
        "https://api.anthropic.com/v1",
        "https://generativelanguage.googleapis.com/v1",
        "https://api.groq.com/openai/v1",
        "https://api.deepseek.com/v1",
        "https://8.8.8.8:8000/v1",
        "https://public-server.com/v1",
    ]
    for ep in forbidden_endpoints:
        with pytest.raises(RuntimeError):
            assert_local_amd_environment(ep)


def test_jwt_token_lifecycle():
    user_payload = {"sub": "dr_sarah", "role": "clinician"}
    token = create_access_token(user_payload)
    assert isinstance(token, str)
    assert len(token) > 20

    decoded = verify_token(token)
    assert decoded["sub"] == "dr_sarah"
    assert decoded["role"] == "clinician"
    assert "exp" in decoded


def test_patient_identifier_hashing():
    hash1 = hash_patient_identifier("PATIENT-9988")
    hash2 = hash_patient_identifier("patient-9988")
    assert hash1 == hash2
    assert len(hash1) == 64
