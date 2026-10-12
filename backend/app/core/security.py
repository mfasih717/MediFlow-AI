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

import ipaddress

# Explicit denylist of commercial public cloud LLM domains
RESTRICTED_CLOUD_HOSTS = {
    "api.openai.com",
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
    "api.cohere.ai",
    "api.mistral.ai",
    "api.groq.com",
    "api.deepseek.com",
    "api.together.xyz",
}

ALLOWED_PRIVATE_DOMAIN_SUFFIXES = (
    ".local",
    ".internal",
    ".lan",
    ".amd.com",
    ".cluster.local",
)


def _is_local_or_private_host(hostname: str) -> bool:
    """Checks whether the hostname is loopback, RFC1918 private IP, or approved internal cluster domain."""
    if not hostname:
        return False
    clean = hostname.lower().strip()
    if clean in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        return True

    # Check if valid private IP address (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, ::1, etc.)
    try:
        ip = ipaddress.ip_address(clean)
        return ip.is_private or ip.is_loopback
    except ValueError:
        pass

    # Approved internal cluster domain suffixes
    return clean.endswith(ALLOWED_PRIVATE_DOMAIN_SUFFIXES)


def assert_local_amd_environment(endpoint_url: str) -> bool:
    """Verifies that the inference endpoint is strictly local or private AMD hardware.
    
    Prevents patient health information (PHI) from being dispatched to public external cloud services.
    
    Raises:
        RuntimeError: If a third-party public cloud endpoint or non-private host is configured.
    """
    parsed = urlparse(endpoint_url)
    hostname = (parsed.hostname or "").lower()

    # 1. Immediate rejection of known commercial public cloud APIs
    for cloud_host in RESTRICTED_CLOUD_HOSTS:
        if cloud_host in hostname:
            err = (
                f"FATAL SECURITY VIOLATION: Endpoint '{endpoint_url}' points to an external cloud LLM ({cloud_host}). "
                "MediFlow AI PHI policy mandates all patient data remain within the AMD ROCm environment."
            )
            logger.critical(err)
            raise RuntimeError(err)

    # 2. Enforce local loopback or private network boundary
    if not _is_local_or_private_host(hostname):
        err = (
            f"SECURITY VIOLATION: Endpoint '{endpoint_url}' resolves to public host '{hostname}'. "
            "Inference server must reside on localhost (127.0.0.1), private cluster network, or internal AMD node."
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
    # Mask Hyphenated and Unhyphenated Pakistani CNIC (13 digits)
    cleaned = re.sub(r"\b\d{5}-\d{7}-\d{1}\b", "[PATIENT_ID_REDACTED]", text)
    cleaned = re.sub(r"\b[1-7]\d{12}\b", "[PATIENT_ID_REDACTED]", cleaned)
    # Mask Pakistani mobile numbers
    cleaned = re.sub(r"(\+92|0)?3\d{2}[-\s.]?\d{7}\b", "[PHONE_REDACTED]", cleaned)
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
