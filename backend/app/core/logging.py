# -*- coding: utf-8 -*-
"""MediFlow AI - Core Logging Module
Structured logging with strict PHI (Protected Health Information) data masking filters.
Ensures zero medical privacy leakage into system logs or external monitoring sinks.
"""

import logging
import re
import sys
from typing import Any, Dict


# Common PHI regex patterns for automated sanitization
# - Pakistani CNIC (xxxxx-xxxxxxx-x)
# - Phone numbers (03xx-xxxxxxx or +923xxxxxxxxx)
# - Email addresses
CNIC_PATTERN = re.compile(r"\b\d{5}-\d{7}-\d{1}\b")
CNIC_UNHYPHENATED_PATTERN = re.compile(r"\b[1-7]\d{12}\b")
PHONE_PATTERN = re.compile(r"(\+92|0)?3\d{2}[-\s.]?\d{7}\b")
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")


class PHIMaskingFilter(logging.Filter):
    """Logging filter that redacts sensitive patient identifiers from all log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.mask_phi(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: (self.mask_phi(v) if isinstance(v, str) else v) for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(self.mask_phi(arg) if isinstance(arg, str) else arg for arg in record.args)
        return True

    @staticmethod
    def mask_phi(text: str) -> str:
        if not isinstance(text, str):
            return text
        sanitized = CNIC_PATTERN.sub("[REDACTED_CNIC]", text)
        sanitized = CNIC_UNHYPHENATED_PATTERN.sub("[REDACTED_CNIC]", sanitized)
        sanitized = PHONE_PATTERN.sub("[REDACTED_PHONE]", sanitized)
        sanitized = EMAIL_PATTERN.sub("[REDACTED_EMAIL]", sanitized)
        return sanitized


def setup_logging(debug: bool = False) -> logging.Logger:
    """Initialize structured application logging with PHI masking."""
    log_level = logging.DEBUG if debug else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.addFilter(PHIMaskingFilter())

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers = [handler]

    # Silence overly verbose external loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    logger = logging.getLogger("mediflow")
    logger.setLevel(log_level)
    return logger


logger = setup_logging()
