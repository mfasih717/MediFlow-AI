# -*- coding: utf-8 -*-
"""MediFlow AI - Bilingual Patient Chat & Triage Schemas"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.triage import TriageTier, RedFlagFinding


class ChatHistoryEntry(BaseModel):
    role: str = Field(..., description="'user', 'assistant', or 'system'")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Patient message in English, Urdu Nastaliq, or Roman Urdu")
    patient_id: Optional[str] = "demo-patient-001"
    language_preference: str = Field(default="mixed", description="'ur', 'en', or 'mixed'")
    history: List[ChatHistoryEntry] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply_english: str
    reply_urdu: str
    triage_tier: TriageTier
    is_emergency: bool = False
    red_flag_findings: List[RedFlagFinding] = Field(default_factory=list)
    emergency_contact: Optional[str] = None
    clarification_required: bool = False
    suggested_quick_replies: List[str] = Field(default_factory=list)
