# -*- coding: utf-8 -*-
"""MediFlow AI - Document Ingestion & OCR Schemas"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
from app.schemas.triage import TriageTier, RedFlagFinding


class OCRConfidence(BaseModel):
    overall_score: float = Field(..., ge=0.0, le=1.0)
    engine: str = "auto"
    word_count: int = 0
    line_scores: List[float] = Field(default_factory=list)


class ExtractedMedication(BaseModel):
    brand_name: str
    generic_salt: Optional[str] = None
    dosage_strength: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    route: str = "Oral"
    instructions_english: Optional[str] = None
    instructions_urdu: Optional[str] = None
    confidence_score: float = 1.0
    ambiguity_flags: List[str] = Field(default_factory=list)
    safety_warnings: List[str] = Field(default_factory=list)

    @field_validator("ambiguity_flags", "safety_warnings", mode="before")
    @classmethod
    def ensure_list(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(item) for item in v if item is not None]
        return [str(v)]


class IngestionPipelineResult(BaseModel):
    document_id: str
    patient_id: Optional[str] = None
    filename: str
    triage_tier: TriageTier
    is_emergency: bool = False
    ocr_confidence: float
    raw_text: str
    extracted_medications: List[ExtractedMedication] = Field(default_factory=list)
    clarification_questions: List[str] = Field(default_factory=list)
    emergency_findings: List[RedFlagFinding] = Field(default_factory=list)
    urdu_summary: Optional[str] = None
    english_summary: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    triage_tier: TriageTier
    is_emergency: bool
    ocr_confidence: float
    medications_count: int
    medications: List[ExtractedMedication]
    clarification_required: bool
    clarification_questions: List[str]
    urdu_summary: Optional[str]
    english_summary: Optional[str]
