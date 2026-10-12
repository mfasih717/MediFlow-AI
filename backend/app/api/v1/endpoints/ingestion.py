# -*- coding: utf-8 -*-
"""MediFlow AI - Ingestion Endpoints
Handles prescription and clinical document uploads (PDF/Images),
executing the full LangGraph OCR and clinical validation pipeline.
"""

from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.db.session import get_db
from app.schemas.ingestion import DocumentUploadResponse
from app.services.document_service import document_service

router = APIRouter()

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/tiff",
}


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload prescription scan or PDF for automated clinical processing",
    description="Extracts medication entities, verifies dosage bounds, and localizes instructions into Nastaliq Urdu.",
)
async def upload_document(
    file: UploadFile = File(..., description="Prescription scan (PDF, PNG, JPG)"),
    patient_id: Optional[str] = Form(default=None, description="Optional patient identifier"),
    db: AsyncSession = Depends(get_db),
) -> DocumentUploadResponse:
    # 1. Validate MIME type
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{content_type}'. Please upload a PDF or image (PNG/JPEG/TIFF).",
        )

    # 2. Read bytes
    try:
        file_bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read uploaded file stream: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded file content.",
        ) from exc

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # 3. Execute LangGraph Pipeline
    logger.info("Starting ingestion for file '%s' (%s bytes)...", file.filename, len(file_bytes))
    pipeline_result = await document_service.process_document(
        file_bytes=file_bytes,
        filename=file.filename or "prescription_scan.jpg",
        patient_id=patient_id,
        db_session=db,
    )

    return DocumentUploadResponse(
        document_id=pipeline_result.document_id,
        filename=pipeline_result.filename,
        triage_tier=pipeline_result.triage_tier,
        is_emergency=pipeline_result.is_emergency,
        ocr_confidence=pipeline_result.ocr_confidence,
        medications_count=len(pipeline_result.extracted_medications),
        medications=pipeline_result.extracted_medications,
        clarification_required=bool(pipeline_result.clarification_questions),
        clarification_questions=pipeline_result.clarification_questions,
        urdu_summary=pipeline_result.urdu_summary,
        english_summary=pipeline_result.english_summary,
    )
