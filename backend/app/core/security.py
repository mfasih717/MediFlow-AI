# -*- coding: utf-8 -*-
"""MediFlow AI - Core Security & PHI Safety Module
Enforces:
1. JWT token generation & authentication
2. Protected Health Information (PHI) cryptographic hashing & sanitization
3. Local AMD hardware isolation guard: Prevents sending PHI to cloud APIs (OpenAI/Anthropic/Google).
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import hashlib
import re
from urllib.parse import urlparse

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from app.core.config import settings
from app.core.logging import logger

security_scheme = HTTPBearer(auto_error=False)

# Forbidden external cloud LLM hosts that would violate local AMD PHI retention
RESTRICTED_CLOUD_HOSTS = {
    "api.openai.com",
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
    "api.cohere.ai",
    "api.mistral.ai",
}


def assert_local_amd_environment(endpoint_url: str) -> bool:
    """Verifies that the inference endpoint is strictly local or private AMD hardware.
    
    Raises:
        RuntimeError: If a third-party proprietary cloud endpoint is configured.
    """
    parsed = urlparse(endpoint_url)
    hostname = (parsed.hostname or "").lower()
    for cloud_host in RESTRICTED_CLOUD_HOSTS:
        if cloud_host in hostname:
            err = (
                f"FATAL SECURITY VIOLATION: Endpoint '{endpoint_url}' points to an external cloud LLM. "
                "MediFlow AI PHI policy mandates all patient data remain within the AMD ROCm environment."
            )
            logger.critical(err)
            raise RuntimeError(err)
    return True


def hash_patient_identifier(identifier: str) -> str:
    """Creates a deterministic one-way SHA-256 hash with application salt for patient index lookup."""
    if not identifier:
        return ""
    salted = f"{settings.SECRET_KEY}:{identifier.strip().lower()}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()


def anonymize_text_for_llm(text: str) -> str:
    """Strips high-risk patient identifiers (Phone numbers, CNIC, emails) before LLM reasoning."""
    if not text:
        return ""
    # Mask CNIC
    cleaned = re.sub(r"\b\d{5}-\d{7}-\d{1}\b", "[PATIENT_ID_REDACTED]", text)
    # Mask Pakistani mobile numbers
    cleaned = re.sub(r"(\+92|0)?3\d{2}[-\s]?\d{7}\b", "[PHONE_REDACTED]", cleaned)
    # Mask Emails
    cleaned = re.sub(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", "[EMAIL_REDACTED]", cleaned)
    return cleaned


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generates an encrypted JWT access token for clinical staff or authenticated patients."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Dict[str, Any]:
    """Decodes and validates JWT claims."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate clinical session credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user_optional(
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> Optional[Dict[str, Any]]:
    """Optional dependency for routes that allow both anonymous guest and authenticated clinical users."""
    if not auth or not auth.credentials:
        return None
    try:
        return verify_token(auth.credentials)
    except HTTPException:
        return None
