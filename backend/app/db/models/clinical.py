# -*- coding: utf-8 -*-
"""MediFlow AI - Unified Clinical Database Models
Contains Patient, Document, Medication, CarePlan, and ClinicalTerminology pgvector models.
"""

from datetime import date, datetime, timezone
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    Boolean,
)
from sqlalchemy.orm import relationship
from app.db.session import Base

try:
    from pgvector.sqlalchemy import Vector
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False
    Vector = None  # type: ignore


class Patient(Base):
    """Patient demographic and medical history record."""
    __tablename__ = "patients"

    id = Column(String(64), primary_key=True, index=True)
    external_mrn = Column(String(64), unique=True, index=True, nullable=True)  # Medical Record Number
    name_encrypted = Column(String(255), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    contact_hash = Column(String(64), index=True, nullable=True)
    language_preference = Column(String(10), default="ur")  # "ur" or "en"
    chronic_conditions = Column(JSON, default=list)  # ["Hypertension", "Type 2 Diabetes"]
    known_allergies = Column(JSON, default=list)      # ["Penicillin", "Sulfa"]
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    documents = relationship("Document", back_populates="patient", cascade="all, delete-orphan")
    medications = relationship("Medication", back_populates="patient", cascade="all, delete-orphan")
    care_plans = relationship("CarePlan", back_populates="patient", cascade="all, delete-orphan")


class Document(Base):
    """Ingested prescription scan, PDF report, or physician notes."""
    __tablename__ = "documents"

    id = Column(String(64), primary_key=True, index=True)
    patient_id = Column(String(64), ForeignKey("patients.id", ondelete="CASCADE"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # "application/pdf", "image/jpeg", etc.
    storage_path = Column(String(512), nullable=True)
    raw_ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, default=0.0)
    ocr_engine = Column(String(50), default="auto")
    triage_tier = Column(String(50), default="tier_1_routine")
    is_emergency = Column(Boolean, default=False)
    human_verified = Column(Boolean, default=False)
    pipeline_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    patient = relationship("Patient", back_populates="documents")
    medications = relationship("Medication", back_populates="document", cascade="all, delete-orphan")


class Medication(Base):
    """Prescribed drug entity, active salt, dosage strength, and frequency instructions."""
    __tablename__ = "medications"

    id = Column(String(64), primary_key=True, index=True)
    patient_id = Column(String(64), ForeignKey("patients.id", ondelete="CASCADE"), nullable=True, index=True)
    document_id = Column(String(64), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)

    brand_name = Column(String(128), nullable=False, index=True)
    generic_salt = Column(String(128), nullable=True, index=True)
    dosage_strength = Column(String(64), nullable=True)     # e.g., "500mg"
    frequency = Column(String(64), nullable=True)           # e.g., "Twice daily"
    duration = Column(String(64), nullable=True)            # e.g., "7 days"
    route = Column(String(32), default="Oral")              # Oral, IV, Topical
    instructions_english = Column(Text, nullable=True)
    instructions_urdu = Column(Text, nullable=True)

    confidence_score = Column(Float, default=1.0)
    is_ambiguous = Column(Boolean, default=False)
    human_verified = Column(Boolean, default=False)
    safety_warnings = Column(JSON, default=list)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    patient = relationship("Patient", back_populates="medications")
    document = relationship("Document", back_populates="medications")


class CarePlan(Base):
    """Patient care journey, timeline schedule, and adherence log."""
    __tablename__ = "care_plans"

    id = Column(String(64), primary_key=True, index=True)
    patient_id = Column(String(64), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="Active Clinical Journey")
    status = Column(String(32), default="active")  # "active", "completed", "suspended"
    start_date = Column(Date, default=date.today)
    end_date = Column(Date, nullable=True)

    # Serialized daily schedule items
    # e.g., [{"dose_id": "...", "medication_name": "Panadol", "time_slot": "morning", "time_str": "08:00", ...}]
    schedule_data = Column(JSON, default=list)

    urdu_overview = Column(Text, nullable=True)
    english_overview = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    patient = relationship("Patient", back_populates="care_plans")


class ClinicalTerminology(Base):
    """Bilingual clinical terminology & drug-salt knowledge base with pgvector embeddings."""
    __tablename__ = "clinical_terminologies"

    id = Column(String(64), primary_key=True, index=True)
    term_english = Column(String(255), nullable=False, index=True)
    term_urdu = Column(String(255), nullable=True, index=True)
    category = Column(String(64), nullable=False)  # "medication", "salt", "symptom", "contraindication"
    generic_salt = Column(String(128), nullable=True, index=True)
    typical_dosage = Column(String(128), nullable=True)
    max_safe_daily_dose = Column(String(128), nullable=True)
    contraindications = Column(JSON, default=list)
    common_indications = Column(JSON, default=list)

    # 384-dimensional dense semantic embedding vector
    if HAS_PGVECTOR:
        embedding = Column(Vector(384), nullable=True)
    else:
        embedding = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


__all__ = [
    "Patient",
    "Document",
    "Medication",
    "CarePlan",
    "ClinicalTerminology",
    "HAS_PGVECTOR",
]
