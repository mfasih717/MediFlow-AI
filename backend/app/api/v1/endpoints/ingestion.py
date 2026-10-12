# -*- coding: utf-8 -*-
"""MediFlow AI - Ingestion Endpoints
Handles prescription and clinical document uploads (PDF/Images),
executing the full LangGraph OCR and clinical validation pipeline.
"""

from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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

# FIX HIGH-3: Strict allowlist of safe file extensions to prevent path traversal / executable uploads.
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}


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
    # 1. Validate file extension via strict allowlist — prevents .sh / .py / executable uploads.
    import os
    original_filename = file.filename or "upload.bin"
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File extension '{ext}' is not permitted.",
        )

    # 1.5 Validate MIME type with fallback inference for CLI clients (e.g. curl default application/octet-stream)
    content_type = (file.content_type or "").lower()
    ext_mime_map = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
    }
    if content_type in ("application/octet-stream", "binary/octet-stream", "", "application/download"):
        content_type = ext_mime_map.get(ext, content_type)

    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{content_type}'. Please upload a PDF or image (PNG/JPEG/TIFF).",
        )

    # 2. FIX CRIT-3: Stream-read with hard byte cap — never load >MAX_FILE_SIZE_MB into RAM at once.
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    chunks = []
    total_read = 0
    try:
        while True:
            chunk = await file.read(65536)  # 64 KB chunks
            if not chunk:
                break
            total_read += len(chunk)
            if total_read > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB.",
                )
            chunks.append(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to read uploaded file stream: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded file content.",
        ) from exc

    file_bytes = b"".join(chunks)
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # FIX HIGH-1: Server-side magic-byte validation — verify actual file signature, not client Content-Type.
    if not _validate_magic_bytes(file_bytes, content_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File content does not match the declared MIME type.",
        )

    # 3. Execute LangGraph Pipeline
    logger.info("Starting ingestion for file '%s' (%s bytes)...", original_filename, len(file_bytes))
    pipeline_result = await document_service.process_document(
        file_bytes=file_bytes,
        filename=original_filename,
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


_MAGIC_BYTES: dict = {
    "application/pdf": [(0, b"%PDF")],
    "image/jpeg": [(0, b"\xff\xd8\xff")],
    "image/jpg":  [(0, b"\xff\xd8\xff")],
    "image/png":  [(0, b"\x89PNG")],
    "image/webp": [(0, b"RIFF")],
    "image/tiff": [(0, b"II*\x00"), (0, b"MM\x00*")],
}


def _validate_magic_bytes(data: bytes, mime_type: str) -> bool:
    """FIX HIGH-1: Validates actual file content matches its MIME type via magic bytes."""
    signatures = _MAGIC_BYTES.get(mime_type, [])
    if not signatures:
        return True  # Unknown type — let OCR reject it naturally
    if mime_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    header = data[:8]
    return any(header[offset:offset + len(magic)] == magic for offset, magic in signatures)
