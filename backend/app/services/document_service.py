# -*- coding: utf-8 -*-
"""MediFlow AI - Document Processing Service
Orchestrates file upload, OCR extraction, LangGraph execution, and database persistence.
"""

from typing import Any, Dict, List, Optional
import os
import uuid
import aiofiles
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.agent.graph import mediflow_graph
from app.agent.state import AgentState
from app.core.config import settings
from app.core.logging import logger
from app.db.models.clinical import Document, Medication, CarePlan
from app.schemas.ingestion import (
    DocumentUploadResponse,
    ExtractedMedication,
    IngestionPipelineResult,
)
from app.schemas.triage import TriageTier, RedFlagFinding


class DocumentService:
    """Manages clinical document ingestion workflows and database persistence."""

    async def save_uploaded_file(self, file: UploadFile) -> str:
        """Saves uploaded document bytes to local disk securely."""
        filename = file.filename or f"upload_{uuid.uuid4().hex}"
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        target_path = os.path.join(settings.UPLOAD_DIR, unique_name)

        content = await file.read()
        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB",
            )

        async with aiofiles.open(target_path, "wb") as f:
            await f.write(content)

        # Reset read pointer for subsequent processing
        await file.seek(0)
        return target_path

    async def process_document(
        self,
        file_bytes: bytes,
        filename: str,
        patient_id: Optional[str] = None,
        db_session: Optional[AsyncSession] = None,
    ) -> IngestionPipelineResult:
        """Runs the complete LangGraph pipeline on an uploaded document and stores results."""
        doc_id = f"doc-{uuid.uuid4().hex[:12]}"
        pat_id = patient_id or f"pat-{uuid.uuid4().hex[:8]}"

        initial_state: AgentState = {
            "document_id": doc_id,
            "patient_id": pat_id,
            "filename": filename,
            "file_bytes": file_bytes,
            "raw_text": "",
            "ocr_confidence": 1.0,
            "language_preference": "ur",
            "messages": [],
            "errors": [],
        }

        # Execute compiled LangGraph workflow
        final_state = await mediflow_graph.ainvoke(initial_state)

        triage_tier_str = final_state.get("triage_level", "tier_1_routine")
        tier_enum = TriageTier(triage_tier_str) if triage_tier_str in TriageTier._value2member_map_ else TriageTier.TIER_1_ROUTINE
        is_emergency = final_state.get("is_emergency", False)

        extracted_meds = []
        for med in final_state.get("extracted_medications", []):
            med_dict = dict(med) if isinstance(med, dict) else med.model_dump()
            if med_dict.get("ambiguity_flags") is None:
                med_dict["ambiguity_flags"] = []
            elif not isinstance(med_dict["ambiguity_flags"], list):
                med_dict["ambiguity_flags"] = [str(med_dict["ambiguity_flags"])]

            if med_dict.get("safety_warnings") is None:
                med_dict["safety_warnings"] = []
            elif not isinstance(med_dict["safety_warnings"], list):
                med_dict["safety_warnings"] = [str(med_dict["safety_warnings"])]

            extracted_meds.append(ExtractedMedication(**med_dict))
        clarifications = final_state.get("clarification_questions", [])
        findings = [
            RedFlagFinding(**f) for f in final_state.get("red_flags", [])
        ]

        result = IngestionPipelineResult(
            document_id=doc_id,
            patient_id=pat_id,
            filename=filename,
            triage_tier=tier_enum,
            is_emergency=is_emergency,
            ocr_confidence=final_state.get("ocr_confidence", 0.0),
            raw_text=final_state.get("raw_text", ""),
            extracted_medications=extracted_meds,
            clarification_questions=clarifications,
            emergency_findings=findings,
            urdu_summary=final_state.get("urdu_explanation"),
            english_summary=final_state.get("english_explanation"),
        )

        # Persist to database if session is available
        if db_session:
            try:
                # 1. Document record
                db_doc = Document(
                    id=doc_id,
                    patient_id=pat_id,
                    filename=filename,
                    file_type="application/pdf" if filename.endswith(".pdf") else "image/jpeg",
                    raw_ocr_text=final_state.get("raw_text", ""),
                    ocr_confidence=final_state.get("ocr_confidence", 0.0),
                    ocr_engine=final_state.get("ocr_engine_used", "auto"),
                    triage_tier=tier_enum.value,
                    is_emergency=is_emergency,
                    human_verified=not final_state.get("clarification_needed", False),
                    pipeline_metadata={
                        "red_flags": final_state.get("red_flags", []),
                        "clarification_questions": clarifications,
                    },
                )
                db_session.add(db_doc)

                # 2. Medication records
                for med in extracted_meds:
                    db_med = Medication(
                        id=f"med-{uuid.uuid4().hex[:10]}",
                        patient_id=pat_id,
                        document_id=doc_id,
                        brand_name=med.brand_name,
                        generic_salt=med.generic_salt,
                        dosage_strength=med.dosage_strength,
                        frequency=med.frequency,
                        duration=med.duration,
                        route=med.route,
                        instructions_english=med.instructions_english,
                        instructions_urdu=med.instructions_urdu,
                        confidence_score=med.confidence_score,
                        is_ambiguous=bool(med.ambiguity_flags),
                        safety_warnings=med.safety_warnings,
                    )
                    db_session.add(db_med)

                # 3. If Routine (Tier 1), persist CarePlan
                if tier_enum == TriageTier.TIER_1_ROUTINE and final_state.get("timeline_schedule"):
                    db_plan = CarePlan(
                        id=f"plan-{uuid.uuid4().hex[:10]}",
                        patient_id=pat_id,
                        title=f"Care Journey - {filename}",
                        status="active",
                        schedule_data=final_state.get("timeline_schedule", []),
                        urdu_overview=final_state.get("urdu_explanation"),
                        english_overview=final_state.get("english_explanation"),
                    )
                    db_session.add(db_plan)

                await db_session.commit()
                logger.info("Persisted document %s and medications to PostgreSQL.", doc_id)
            except Exception as exc:
                logger.error("Database persistence error during document ingestion: %s", exc)
                await db_session.rollback()

        return result


document_service = DocumentService()
