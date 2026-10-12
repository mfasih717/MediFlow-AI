# -*- coding: utf-8 -*-
"""MediFlow AI - LangGraph State Schema
Defines the shared state throughout the clinical analysis, OCR, triage, and scheduling pipeline.
"""

from typing import Annotated, Any, Dict, List, Optional
from typing_extensions import TypedDict
import operator


class AgentState(TypedDict, total=False):
    # Input data
    raw_text: str
    document_id: Optional[str]
    patient_id: Optional[str]
    file_bytes: Optional[bytes]
    filename: Optional[str]
    language_preference: str  # "ur", "en", or "mixed"

    # OCR Processing output
    ocr_confidence: float
    ocr_engine_used: str
    ocr_lines: List[Dict[str, Any]]

    # Multi-Tier Clinical Safety Matrix
    # Tier 1 (Routine), Tier 2 (Ambiguous / Clarification), Tier 3 (Acute Red-Flag Emergency)
    triage_level: str
    is_emergency: bool
    red_flags: List[Dict[str, Any]]
    emergency_escalation_details: Optional[Dict[str, Any]]

    # Clinical Extraction
    extracted_medications: List[Dict[str, Any]]

    # Safety & Dosage Verification (Tier 2 triggers)
    dosage_validation_issues: List[str]
    clarification_needed: bool
    clarification_questions: List[str]
    human_review_required: bool
    # FIX MED-3: Tracks number of human-review cycles to prevent infinite loops.
    clarification_cycle_count: int

    # Bilingual Localization & Patient Guidance
    urdu_explanation: Optional[str]
    english_explanation: Optional[str]

    # Care Journey Timeline Schedule
    timeline_schedule: List[Dict[str, Any]]

    # Chat & Interaction history
    messages: Annotated[List[Dict[str, Any]], operator.add]
    errors: Annotated[List[str], operator.add]
