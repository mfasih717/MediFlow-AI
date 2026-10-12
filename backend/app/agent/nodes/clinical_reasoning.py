# -*- coding: utf-8 -*-
"""MediFlow AI - Clinical Reasoning Node
AMD ROCm vLLM execution for pharmacological entity extraction, active generic salt identification,
and clinical instruction parsing.
All Urdu literals use pure Unicode escape sequences (\\uXXXX) to guarantee 100% ASCII compatibility.
"""

from typing import Any, Dict, List
import json
import re

from app.agent.state import AgentState
from app.core.logging import logger
from app.core.security import anonymize_text_for_llm
from app.db.vector_store import clinical_vector_store
from app.engine.prompts import (
    CLINICAL_EXTRACTION_SYSTEM_PROMPT,
    CLINICAL_EXTRACTION_USER_PROMPT,
)
from app.engine.vllm_client import vllm_client


def _heuristic_entity_extraction(text: str) -> List[Dict[str, Any]]:
    """Deterministic fallback parser for common clinical prescriptions when LLM is offline."""
    meds: List[Dict[str, Any]] = []
    text_lower = text.lower()

    # Common brand names to check with pure ASCII unicode escape literals
    known_brands = [
        ("panadol", "Paracetamol", "500mg", "Twice daily after meals", "\u06a9\u06be\u0627\u0646\u06d2 \u06a9\u06d2 \u0628\u0639\u062f \u062f\u0646 \u0645\u06cc\u06ba \u062f\u0648 \u0628\u0627\u0631"),
        ("augmentin", "Co-Amoxiclav", "625mg", "Twice daily after meals", "\u06a9\u06be\u0627\u0646\u06d2 \u06a9\u06d2 \u0628\u0639\u062f \u062f\u0646 \u0645\u06cc\u06ba \u062f\u0648 \u0628\u0627\u0631"),
        ("glucophage", "Metformin HCl", "500mg", "Once daily with meals", "\u06a9\u06be\u0627\u0646\u06d2 \u06a9\u06d2 \u0633\u0627\u062a\u06be \u062f\u0646 \u0645\u06cc\u06ba \u0627\u06cc\u06a9 \u0628\u0627\u0631"),
        ("disprin", "Aspirin", "300mg", "Dissolve in water SOS", "\u0636\u0631\u0648\u0631\u062a \u06a9\u06d2 \u0648\u0642\u062a \u067e\u0627\u0646\u06cc \u0645\u06cc\u06ba \u062d\u0644 \u06a9\u0631 \u06a9\u06d2 \u0644\u06cc\u06ba"),
        ("concor", "Bisoprolol", "5mg", "Once daily in morning", "\u0635\u0628\u062d \u06a9\u06d2 \u0648\u0642\u062a \u0631\u0648\u0632\u0627\u0646\u06c1 \u0627\u06cc\u06a9 \u06af\u0648\u0644\u06cc"),
        ("nexum", "Esomeprazole", "40mg", "Once daily before breakfast", "\u0646\u0627\u0634\u062a\u06d2 \u0633\u06d2 \u0642\u0628\u0644 \u062e\u0627\u0644\u06cc \u067e\u06cc\u0679 \u0627\u06cc\u06a9 \u06af\u0648\u0644\u06cc"),
        ("amoxil", "Amoxicillin", "500mg", "TDS 8 hourly", "\u06c1\u0631 8 \u06af\u06be\u0646\u0679\u06d2 \u0628\u0639\u062f \u0627\u06cc\u06a9 \u06a9\u06cc\u067e\u0633\u0648\u0644"),
    ]

    for brand, salt, default_strength, default_inst_en, default_inst_ur in known_brands:
        if brand in text_lower:
            # Check if strength is specified near the brand name
            strength_match = re.search(rf"{brand}\s*(\d+\s*(?:mg|g|ml))", text_lower)
            strength = strength_match.group(1).upper() if strength_match else default_strength

            # Check frequency keywords
            freq = "As directed by physician"
            if "tds" in text_lower or "tid" in text_lower or "three times" in text_lower:
                freq = "Three times daily (TDS)"
            elif "bd" in text_lower or "bid" in text_lower or "twice" in text_lower:
                freq = "Twice daily (BD)"
            elif "od" in text_lower or "once" in text_lower:
                freq = "Once daily (OD)"
            elif "sos" in text_lower or "prn" in text_lower or "as needed" in text_lower:
                freq = "As needed (SOS)"

            meds.append({
                "brand_name": brand.capitalize(),
                "generic_salt": salt,
                "dosage_strength": strength,
                "frequency": freq,
                "duration": "5 to 7 days",
                "route": "Oral",
                "instructions_english": default_inst_en,
                "instructions_urdu": default_inst_ur,
                "confidence_score": 0.90,
                "ambiguity_flags": [],
                "safety_warnings": [],
            })

    return meds


async def clinical_reasoning_node(state: AgentState) -> Dict[str, Any]:
    """LangGraph node: Analyzes clinical text with AMD ROCm vLLM to extract pharmacological entities."""
    raw_text = state.get("raw_text", "")
    if not raw_text.strip():
        return {"extracted_medications": []}

    # Redact patient identifiers before inference to ensure strict HIPAA/PHI compliance
    sanitized_text = anonymize_text_for_llm(raw_text)

    prompt = CLINICAL_EXTRACTION_USER_PROMPT.format(ocr_text=sanitized_text)
    messages = [
        {"role": "system", "content": CLINICAL_EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    extracted_medications: List[Dict[str, Any]] = []

    try:
        response_text = await vllm_client.chat_completion(
            messages=messages,
            temperature=0.1,
            max_tokens=2048,
        )

        # Parse JSON from model output
        cleaned_json = response_text.strip()
        # Strip potential markdown formatting ```json ... ```
        if "```" in cleaned_json:
            cleaned_json = re.sub(r"^```(?:json)?\s*", "", cleaned_json)
            cleaned_json = re.sub(r"\s*```$", "", cleaned_json)

        data = json.loads(cleaned_json)
        extracted_medications = data.get("medications", [])
    except Exception as exc:
        logger.warning(
            "AMD vLLM clinical reasoning call did not return structured JSON (%s); using deterministic knowledge engine.",
            exc,
        )
        extracted_medications = _heuristic_entity_extraction(raw_text)

    # Enrich and sanitize medications with clinical vector knowledge base and default lists
    for med in extracted_medications:
        if med.get("ambiguity_flags") is None:
            med["ambiguity_flags"] = []
        elif not isinstance(med["ambiguity_flags"], list):
            med["ambiguity_flags"] = [str(med["ambiguity_flags"])]

        if med.get("safety_warnings") is None:
            med["safety_warnings"] = []
        elif not isinstance(med["safety_warnings"], list):
            med["safety_warnings"] = [str(med["safety_warnings"])]

        if not med.get("generic_salt"):
            known_salt = await clinical_vector_store.lookup_salt_by_brand(None, med.get("brand_name", ""))
            if known_salt:
                med["generic_salt"] = known_salt.get("generic_salt")
                if not med.get("safety_warnings"):
                    med["safety_warnings"] = known_salt.get("contraindications", []) or []

    return {
        "extracted_medications": extracted_medications,
    }
