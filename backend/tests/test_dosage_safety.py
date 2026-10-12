# -*- coding: utf-8 -*-
"""MediFlow AI - Unit Tests for Dosage Validator & Pharmacological Bounds
Tests strength parsing, frequency multipliers, and daily overdose prevention bounds.
"""

import pytest
from app.agent.nodes.dosage_validator import (
    _parse_mg_strength,
    _get_frequency_multiplier,
    dosage_validator_node,
)


def test_parse_mg_strength():
    assert _parse_mg_strength("500mg") == 500.0
    assert _parse_mg_strength("1g") == 1000.0
    assert _parse_mg_strength("2.5 mg") == 2.5
    assert _parse_mg_strength("625mg") == 625.0
    assert _parse_mg_strength("unknown") == 0.0
    assert _parse_mg_strength("") == 0.0


def test_frequency_multiplier():
    assert _get_frequency_multiplier("Once daily (OD)") == 1
    assert _get_frequency_multiplier("Twice daily (BD)") == 2
    assert _get_frequency_multiplier("Three times daily (TDS)") == 3
    assert _get_frequency_multiplier("Four times daily (QID)") == 4
    assert _get_frequency_multiplier("Every 8 hours") == 1  # default fallback if no keyword matches


@pytest.mark.asyncio
async def test_dosage_validator_overdose_detection():
    # Paracetamol safe max is 4000mg/day.
    # 2000mg three times daily = 6000mg/day -> Overdose!
    mock_state = {
        "raw_text": "Take Panadol 2000mg three times daily",
        "ocr_confidence": 0.95,
        "extracted_medications": [
            {
                "brand_name": "Panadol",
                "generic_salt": "Paracetamol",
                "dosage_strength": "2000mg",
                "frequency": "Three times daily (TDS)",
                "ambiguity_flags": [],
                "safety_warnings": [],
            }
        ],
    }
    result = await dosage_validator_node(mock_state)
    assert result["triage_level"] == "tier_2_ambiguous"
    assert result["clarification_needed"] is True
    assert result["human_review_required"] is True
    assert any("exceeds maximum recommended daily bound" in issue for issue in result["dosage_validation_issues"])


@pytest.mark.asyncio
async def test_dosage_validator_safe_regimen():
    # Paracetamol 500mg twice daily = 1000mg/day -> Safe (well under 4000mg)
    mock_state = {
        "raw_text": "Take Panadol 500mg twice daily",
        "ocr_confidence": 0.95,
        "extracted_medications": [
            {
                "brand_name": "Panadol",
                "generic_salt": "Paracetamol",
                "dosage_strength": "500mg",
                "frequency": "Twice daily (BD)",
                "ambiguity_flags": [],
                "safety_warnings": [],
            }
        ],
    }
    result = await dosage_validator_node(mock_state)
    assert result["triage_level"] == "tier_1_routine"
    assert result["clarification_needed"] is False
    assert result["human_review_required"] is False
    assert len(result["dosage_validation_issues"]) == 0


@pytest.mark.asyncio
async def test_dosage_validator_low_ocr_confidence():
    mock_state = {
        "raw_text": "Blurred text Panadol",
        "ocr_confidence": 0.45,  # below 0.75 threshold
        "extracted_medications": [
            {
                "brand_name": "Panadol",
                "generic_salt": "Paracetamol",
                "dosage_strength": "500mg",
                "frequency": "Once daily",
                "ambiguity_flags": [],
                "safety_warnings": [],
            }
        ],
    }
    result = await dosage_validator_node(mock_state)
    assert result["triage_level"] == "tier_2_ambiguous"
    assert result["clarification_needed"] is True
    assert any("Low document scan confidence" in issue for issue in result["dosage_validation_issues"])
