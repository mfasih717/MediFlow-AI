# -*- coding: utf-8 -*-
"""MediFlow AI - Core Configuration Module
Pydantic v2 settings management optimized for AMD Developer Cloud & local vLLM inference.
"""

from typing import Any, List, Union
import json
import os
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            ".env",
            "backend/.env",
            os.path.join(os.path.dirname(__file__), "../../.env"),
            os.path.join(os.path.dirname(__file__), "../../../.env"),
        ),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # General App Config
    PROJECT_NAME: str = "MediFlow AI"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"
    HOST: str = "0.0.0.0"
    PORT: int = Field(default=8080, description="FastAPI server port (distinct from vLLM on 8000)")

    # AMD ROCm / vLLM Local Inference Engine
    # Queries AMD-accelerated local vLLM instance; strictly forbids public cloud LLMs for patient PHI.
    VLLM_BASE_URL: str = Field(
        default="http://127.0.0.1:8000/v1",
        description="Local AMD ROCm vLLM server endpoint",
    )
    VLLM_MODEL_NAME: str = Field(
        default="Qwen/Qwen2.5-7B-Instruct",
        description="Generation model served on AMD ROCm vLLM",
    )
    VLLM_EMBEDDING_MODEL_NAME: str = Field(
        default="BAAI/bge-small-en-v1.5",
        description="Local embedding model for pgvector semantic search",
    )
    VLLM_API_KEY: str = Field(
        default="local-amdsmi-auth-not-required",
        description="API key for local vLLM proxy",
    )
    VLLM_TIMEOUT_SECONDS: float = Field(
        default=60.0,
        description="HTTP request timeout for AMD GPU LLM completions",
    )
    VLLM_MAX_TOKENS: int = 2048
    VLLM_TEMPERATURE: float = 0.1

    # AMD ROCm & GPU Telemetry Configuration
    ROCM_PATH: str = "/opt/rocm"
    HIP_VISIBLE_DEVICES: str = "0"
    # Parameterized: left empty for native Instinct MI detection (gfx90a/gfx940/gfx942)
    HSA_OVERRIDE_GFX_VERSION: str = ""

    # PostgreSQL + pgvector Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://mediflow_user:mediflow_password@127.0.0.1:5432/mediflow_db",
        description="Async SQLAlchemy database connection string",
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False

    # Security & Authentication
    # FIX CRIT-1: No hardcoded defaults — must be supplied via environment variables.
    SECRET_KEY: str = Field(
        ...,
        description="JWT signing secret. Must be >= 32 chars. Set via SECRET_KEY env var.",
    )
    ALGORITHM: str = "HS256"
    # FIX MED-1: Reduced from 1440 (24h) to 60 minutes for clinical safety.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALLOWED_ORIGINS: Union[str, List[str]] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
        ]
    )
    # FIX CRIT-2: PHI_ENCRYPTION_KEY now mandatory with no default.
    PHI_ENCRYPTION_KEY: str = Field(
        ...,
        description="AES-256 key for PHI column encryption. Must be exactly 32 bytes. Set via env var.",
    )

    # OCR Processing Settings
    OCR_ENGINE: str = "auto"  # "paddleocr" | "tesseract" | "auto"
    OCR_LANGUAGES: str = "en,ur"
    OCR_CONFIDENCE_THRESHOLD: float = 0.75

    # Multi-Tier Clinical Safety Matrix
    TIER3_RED_FLAG_THRESHOLD: float = 0.90
    EMERGENCY_CONTACT_NUMBER: str = "1122"  # Pakistan National Rescue Service
    EMERGENCY_ALT_CONTACT: str = "911"

    # Storage Settings
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 15
    # FIX CRIT-3: Hard cap on request body size enforced at ASGI middleware level.
    MAX_REQUEST_BODY_BYTES: int = 16 * 1024 * 1024  # 16 MB absolute ceiling

    # Chat input guard — prevents token flooding and prompt injection
    MAX_CHAT_MESSAGE_LENGTH: int = 4000  # characters

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_strength(cls, v: str) -> str:
        """Reject weak or default SECRET_KEY values at startup."""
        weak_markers = ["mediflow-production", "changeme", "secret", "example", "default"]
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")
        if any(marker in v.lower() for marker in weak_markers):
            raise ValueError(
                "SECRET_KEY contains a known-weak default string. "
                "Generate a cryptographically random key (e.g., `openssl rand -hex 32`)."
            )
        return v

    @field_validator("PHI_ENCRYPTION_KEY")
    @classmethod
    def phi_key_strength(cls, v: str) -> str:
        """Enforce exactly 32-byte AES key; reject known weak defaults."""
        weak_markers = ["mediflow-phi", "changeme", "example", "default"]
        if len(v.encode("utf-8")) != 32:
            raise ValueError(
                "PHI_ENCRYPTION_KEY must be exactly 32 UTF-8 bytes for AES-256. "
                f"Got {len(v.encode('utf-8'))} bytes."
            )
        if any(marker in v.lower() for marker in weak_markers):
            raise ValueError(
                "PHI_ENCRYPTION_KEY contains a known-weak default string. "
                "Generate a random 32-byte key for production."
            )
        return v

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        """Safely parses list, JSON string, or comma-separated strings for CORS.
        Never fails and always returns a valid List[str].
        """
        fallback_default = [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
        ]
        if not v:
            return fallback_default

        # 1. If it is already a list (or iterable collection), return cleaned list of strings
        if isinstance(v, (list, tuple, set)):
            cleaned = [str(item).strip() for item in v if str(item).strip()]
            return cleaned if cleaned else fallback_default

        # 2. If it is a string
        if isinstance(v, str):
            clean_str = v.strip()
            # Strip outer surrounding quotes if dotenv or shell left them
            if (clean_str.startswith('"') and clean_str.endswith('"')) or (
                clean_str.startswith("'") and clean_str.endswith("'")
            ):
                clean_str = clean_str[1:-1].strip()

            if not clean_str:
                return fallback_default

            # If it is a string starting with '[' and ending with ']', parse with json.loads safely
            if clean_str.startswith("[") and clean_str.endswith("]"):
                try:
                    parsed = json.loads(clean_str)
                    if isinstance(parsed, list):
                        cleaned = [str(item).strip() for item in parsed if str(item).strip()]
                        if cleaned:
                            return cleaned
                except Exception:
                    clean_str = clean_str[1:-1].strip()

            # If it is a comma-separated string, split by ',' and strip whitespace
            parsed_origins = [
                origin.strip().strip('"\'')
                for origin in clean_str.split(",")
                if origin.strip().strip('"\'')
            ]
            return parsed_origins if parsed_origins else fallback_default

        # Catch-all safe string conversion
        return [str(v).strip()]


# Global singleton settings
settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
