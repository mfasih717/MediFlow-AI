# -*- coding: utf-8 -*-
"""MediFlow AI - Triage & Safety Schemas"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class TriageTier(str, Enum):
    """Clinical Safety Matrix Tiers:
    - Tier 1: Routine care journey, safe for automated patient scheduling & layman translation.
    - Tier 2: Ambiguous OCR, missing dosage, or doubtful drug salt; requires human clarification.
    - Tier 3: Deterministic acute red-flag emergency; freezes automation & triggers immediate 1122 escalation.
    """
    TIER_1_ROUTINE = "tier_1_routine"
    TIER_2_AMBIGUOUS = "tier_2_ambiguous"
    TIER_3_ACUTE_EMERGENCY = "tier_3_acute_emergency"


class RedFlagFinding(BaseModel):
    symptom_key: str
    trigger_keyword: str
    urgency_level: str = "IMMEDIATE_LIFE_THREAT"
    matched_language: str = "en"  # "en" or "ur"
    recommended_action: str


class TriageAssessment(BaseModel):
    tier: TriageTier
    is_emergency: bool = False
    clarification_required: bool = False
    red_flags: List[RedFlagFinding] = Field(default_factory=list)
    clinical_summary: str
    urdu_emergency_instructions: Optional[str] = None
    english_emergency_instructions: Optional[str] = None
    emergency_contacts: List[str] = Field(default_factory=lambda: ["1122", "911"])
