# -*- coding: utf-8 -*-
"""MediFlow AI - FastAPI Application Entry Point
Intelligent Patient Journey Assistant & Clinical Co-Pilot
Configured for AMD Developer Cloud (ROCm 6.x + local vLLM on port 8000), FastAPI on port 8080.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import logger
from app.core.security import assert_local_amd_environment
from app.db.session import init_db
from app.engine.vllm_client import vllm_client


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager: hardware validation, DB setup, and graceful teardown."""
    logger.info("Initializing %s v%s on port %d...", settings.PROJECT_NAME, settings.VERSION, settings.PORT)

    # 1. Hardware residency security verification
    assert_local_amd_environment(settings.VLLM_BASE_URL)
    logger.info("AMD ROCm Local vLLM residency verified: %s", settings.VLLM_BASE_URL)

    # 2. Initialize Database & vector extension
    try:
        await init_db()
    except Exception as exc:
        logger.warning("Database initialization deferred: %s", exc)

    # 3. Test connection to local AMD vLLM engine
    vllm_status = await vllm_client.check_health()
    if vllm_status.get("online"):
        logger.info(
            "AMD vLLM connection established (Model: %s, Latency: %sms)",
            vllm_status.get("model_name"),
            vllm_status.get("latency_ms"),
        )
    else:
        logger.warning(
            "AMD vLLM instance not detected at %s. (Deterministic fallback active).",
            settings.VLLM_BASE_URL,
        )

    yield

    # Teardown
    logger.info("Closing MediFlow AI connection pools...")
    await vllm_client.close()
    logger.info("MediFlow AI shutdown complete.")


def create_application() -> FastAPI:
    """Factory function for FastAPI application."""
    # FIX MED-2: Disable Swagger/ReDoc docs in production to avoid exposing API surface.
    docs_url = "/docs" if settings.DEBUG else None
    redoc_url = "/redoc" if settings.DEBUG else None

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=(
            "MediFlow AI is an Intelligent Patient Journey Assistant & Clinical Co-Pilot. "
            "Optimized for AMD Developer Cloud (ROCm 6.x + local vLLM inference), PostgreSQL 16 (pgvector), "
            "and LangGraph clinical safety workflows."
        ),
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # Cross-Origin Resource Sharing (CORS) Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global Exception Handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled error encountered on %s: %s", request.url.path, exc, exc_info=True)
        # FIX HIGH-5: Do NOT expose raw exception details in production. Log them; return generic message.
        if settings.DEBUG:
            detail = str(exc)
        else:
            detail = "An internal server error occurred. Please contact support."
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": detail, "path": str(request.url.path)},
        )

    # Mount API v1 Master Router
    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.get("/", tags=["Root"])
    async def root():
        return {
            "message": "MediFlow AI Backend Service Running",
            "version": settings.VERSION,
            "port": settings.PORT,
            # FIX MED-2: Do not advertise docs URL in production
            "docs": "/docs" if settings.DEBUG else "Disabled in production",
            "api_v1": settings.API_V1_STR,
            "amd_telemetry": f"{settings.API_V1_STR}/health/amd-rocm",
            "infrastructure": "AMD Developer Cloud (ROCm 6.x)",
        }

    @app.get("/health", tags=["Root"])
    async def liveness_health():
        return {
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "port": settings.PORT,
            "version": settings.VERSION,
        }

    return app


app = create_application()
