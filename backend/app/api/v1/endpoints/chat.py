# -*- coding: utf-8 -*-
"""MediFlow AI - Bilingual Patient Chat & Triage Endpoints
Provides real-time conversational clinical guidance and deterministic Tier 3 emergency detection.
"""

from fastapi import APIRouter, status
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import chat_service

router = APIRouter()


@router.post(
    "",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
@router.post(
    "/",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Bilingual conversation with deterministic emergency triage",
    description="Processes patient query in English, Urdu Nastaliq, or Roman Urdu. Triggers Tier 3 emergency halts on acute red-flags.",
)
async def chat_interaction(request: ChatRequest) -> ChatResponse:
    response = await chat_service.process_chat(request)
    return response


@router.post(
    "/stream",
    summary="Streaming bilingual conversation endpoint",
    description="Streams Server-Sent Events (SSE) tokens directly from the local AMD ROCm vLLM engine.",
)
async def chat_stream(request: ChatRequest):
    async def event_generator():
        async for chunk in chat_service.stream_chat_tokens(request):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
