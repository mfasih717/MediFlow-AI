# -*- coding: utf-8 -*-
"""MediFlow AI - API v1 Master Router
Assembles ingestion, timeline, chat, and system health endpoints.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import chat, health, ingestion, timeline

api_router = APIRouter()

api_router.include_router(ingestion.router, prefix="/ingestion", tags=["Document Ingestion & OCR"])
api_router.include_router(timeline.router, prefix="/timeline", tags=["Care Journey & Timeline"])
api_router.include_router(chat.router, prefix="/chat", tags=["Bilingual Chat & Triage"])
api_router.include_router(health.router, prefix="/health", tags=["ROCm Health & Telemetry"])
