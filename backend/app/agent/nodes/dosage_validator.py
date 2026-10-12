# -*- coding: utf-8 -*-
"""MediFlow AI - Dosage Validator Node (Tier 2 Clinical Ambiguity & Safety Guard)
Applies deterministic pharmacological bounds, checks OCR confidence integrity,
and generates bilingual clarification queries when safety standards are breached.
"""

from typing import Any, Dict, List, Tuple
import re

from app.agent.state import AgentState
from app.agent.nodes.triage_guardrail import scan_for_ambiguity
from app.core.config import settings
from app.core.logging import logger

# Maximum safe DAILY doses for common medications (milligrams)
MAX_DAILY_SAFE_DOSE = {
    "paracetamol": 4000,   # 4000mg (4g) per day
    "acetaminophen": 4000,
    "metformin": 2550,     # 2550mg per day
    "aspirin": 4000,       # 4000mg per day
    "bisoprolol": 20,      # 20mg per day
    "esomeprazole": 80,    # 80mg per day
    "ibuprofen": 3200,     # 3200mg per day
}

# FIX BUG-2 (HIGH-8): Frequency multiplier map to compute actual daily dose from per-dose strength.
FREQUENCY_MULTIPLIER: Dict[str, int] = {
    "once": 1,
    "od": 1,
    "twice": 2,
    "bd": 2,
    "bid": 2,
    "tds": 3,
    "tid": 3,
    "three": 3,
    "qid": 4,
    "four": 4,
}


def _parse_mg_strength(strength_str: str) -> float:
    """Parses numeric milligrams from dosage strings like '500mg', '1g', '850 mg'."""
    if not strength_str:
        return 0.0
    clean = strength_str.lower().strip()
    g_match = re.search(r"(\d+(?:\.\d+)?)\s*g\b", clean)
    if g_match:
        return float(g_match.group(1)) * 1000.0

    mg_match = re.search(r"(\d+(?:\.\d+)?)\s*mg\b", clean)
    if mg_match:
        return float(mg_match.group(1))

    # Plain integer
    num_match = re.search(r"\b(\d+)\b", clean)
    if num_match:
        return float(num_match.group(1))
    return 0.0


def _get_frequency_multiplier(frequency_str: str) -> int:
    """FIX BUG-2: Returns the number of doses per day for a given frequency string."""
    freq_lower = (frequency_str or "").lower()
    for keyword, multiplier in FREQUENCY_MULTIPLIER.items():
        if keyword in freq_lower:
            return multiplier
    return 1  # Default: once daily


async def dosage_validator_node(state: AgentState) -> Dict[str, Any]:
    """LangGraph node: Validates medication safety, dosage bounds, and OCR clarity."""
    # Never downgrade an already detected Tier 3 Acute Emergency
    if state.get("is_emergency") or state.get("triage_level") == "tier_3_acute_emergency":
        # FIX MED-7: human_review_required must be False for Tier 3 — this is an emergency, not a review.
        return {
            "clarification_needed": False,
            "human_review_required": False,
        }

    issues: List[str] = []
    questions: List[str] = []
    medications = state.get("extracted_medications", [])
    ocr_confidence = state.get("ocr_confidence", 1.0)

    # 1. OCR Confidence check: if scan quality is below threshold, trigger Tier 2
    if ocr_confidence < settings.OCR_CONFIDENCE_THRESHOLD:
        issues.append(
            f"Low document scan confidence ({int(ocr_confidence * 100)}% < {int(settings.OCR_CONFIDENCE_THRESHOLD * 100)}%). "
            "Handwriting or image blur prevents automated clinical verification."
        )
        questions.append("Could you please provide a clearer photo or confirm the physician's prescription details?")
        questions.append("\u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u0646\u0633\u062e\u06d2 \u06a9\u06cc \u0648\u0627\u0636\u062d \u062a\u0635\u0648\u06cc\u0631 \u0641\u0631\u0627\u06c1\u0645 \u06a9\u0631\u06cc\u06ba \u06cc\u0627 \u062f\u0648\u0627\u0624\u06ba \u06a9\u06d2 \u0646\u0627\u0645\u0648\u06ba \u06a9\u06cc \u062a\u0635\u062f\u06cc\u0642 \u0641\u0631\u0645\u0627\u0626\u06cc\u06ba\u06d4")

    # 1.5 Scan for illegibility and missing dosage markers in document text
    raw_doc_text = state.get("raw_text", "")
    if raw_doc_text and scan_for_ambiguity(raw_doc_text):
        issues.append("Document or notes contain explicit ambiguity/illegibility flags ('unreadable', 'blurred', 'missing dosage').")
        questions.append("The prescription indicates unclear or blurred dosage instructions. Please confirm the exact strength and frequency.")
        questions.append("\u0646\u0633\u062e\u06d2 \u0645\u06cc\u06ba \u062f\u0648\u0627 \u06a9\u06cc \u062e\u0648\u0631\u0627\u06a9 \u06cc\u0627 \u06c1\u062f\u0627\u06cc\u0627\u062a \u0648\u0627\u0636\u062d \u0646\u06c1\u06cc\u06ba \u06c1\u06cc\u06ba\u06d4 \u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u0688\u0627\u06a9\u0679\u0631 \u0633\u06d2 \u062a\u0635\u062f\u06cc\u0642 \u0641\u0631\u0645\u0627\u0626\u06cc\u06ba\u06d4")

    # 2. Empty medication extraction check (trigger Tier 2 if zero medications detected)
    if not medications:
        issues.append("Document does not contain any verifiable pharmaceutical medications.")
        questions.append("We could not identify any prescribed medications in this document. Please upload a clear prescription scan or consult your doctor.")
        questions.append("\u0627\u0633 \u062f\u0633\u062a\u0627\u0648\u06cc\u0632 \u0645\u06cc\u06ba \u06a9\u0648\u0626\u06cc \u062f\u0648\u0627 \u0634\u0646\u0627\u062e\u062a \u0646\u06c1\u06cc\u06ba \u06c1\u0648 \u0633\u06a9\u06cc\u06d4 \u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u0635\u0627\u0641 \u0646\u0633\u062e\u06c1 \u0627\u067e \u0644\u0648\u0688 \u06a9\u0631\u06cc\u06ba\u06d4")

    # 3. Individual medication sanity checks
    for med in medications:
        brand = med.get("brand_name", "").strip()
        salt = (med.get("generic_salt", "") or brand).lower()
        strength = med.get("dosage_strength", "")
        freq = med.get("frequency", "")

        # Check missing dosage strength
        if not strength or strength.lower() in ["unknown", "none", ""]:
            issues.append(f"Missing dosage strength for medication: {brand}")
            questions.append(f"What is the exact strength/milligram for {brand} (e.g. 500mg, 250mg)?")
            questions.append(f"\u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u062f\u0648\u0627 '{brand}' \u06a9\u06cc \u067e\u0648\u0679\u06cc\u0646\u0633\u06cc (\u0645\u062b\u0644\u0627\u064b 500mg) \u06a9\u06cc \u062a\u0635\u062f\u06cc\u0642 \u0641\u0631\u0645\u0627\u0626\u06cc\u06ba\u06d4")
            med["ambiguity_flags"].append("Missing dosage strength")

        # Check missing frequency instructions
        if not freq or freq.lower() in ["unknown", "none", ""]:
            issues.append(f"Missing frequency instructions for medication: {brand}")
            questions.append(f"How many times a day did your doctor advise taking {brand}?")
            questions.append(f"\u0688\u0627\u06a9\u0679\u0631 \u0646\u06d2 '{brand}' \u062f\u0646 \u0645\u06cc\u06ba \u06a9\u062a\u0646\u06cc \u0628\u0627\u0631 \u0644\u06cc\u0646\u06d2 \u06a9\u0627 \u0645\u0634\u0648\u0631\u06c1 \u062f\u06cc\u0627 \u06c1\u06d2\u061f")
            med["ambiguity_flags"].append("Missing frequency instruction")

        # FIX BUG-2 (HIGH-8): Compute actual DAILY dose = per-dose strength × frequency multiplier.
        mg_per_dose = _parse_mg_strength(strength)
        daily_multiplier = _get_frequency_multiplier(freq)
        actual_daily_mg = mg_per_dose * daily_multiplier

        for drug_key, max_safe in MAX_DAILY_SAFE_DOSE.items():
            if drug_key in salt:
                if actual_daily_mg > max_safe:
                    warning_msg = (
                        f"DANGER: {brand} ({salt.capitalize()}) estimated daily dose "
                        f"{actual_daily_mg}mg ({mg_per_dose}mg × {daily_multiplier}x/day) "
                        f"exceeds maximum recommended daily bound ({max_safe}mg)."
                    )
                    issues.append(warning_msg)
                    med["safety_warnings"].append(warning_msg)
                    questions.append(
                        f"The prescribed dose of {brand} ({mg_per_dose}mg, {daily_multiplier}x/day = {actual_daily_mg}mg/day) "
                        f"appears unusually high. Please confirm with your prescribing physician immediately."
                    )
                    questions.append(
                        f"\u062a\u0648\u062c\u06c1 \u0641\u0631\u0645\u0627\u0626\u06cc\u06ba: {brand} \u06a9\u06cc \u0645\u0642\u062f\u0627\u0631 \u0645\u0639\u0645\u0648\u0644 \u0633\u06d2 \u0632\u06cc\u0627\u062f\u06c1 \u0645\u0639\u0644\u0648\u0645 \u06c1\u0648\u062a\u06cc \u06c1\u06d2\u06d4 \u0628\u0631\u0627\u0626\u06d2 \u0645\u06c1\u0631\u0628\u0627\u0646\u06cc \u0641\u0648\u0631\u06cc \u0637\u0648\u0631 \u067e\u0631 \u0627\u067e\u0646\u06d2 \u0688\u0627\u06a9\u0679\u0631 \u0633\u06d2 \u062a\u0635\u062f\u06cc\u0642 \u06a9\u0631\u06cc\u06ba\u06d4"
                    )

    # Multi-Tier Clinical Classification
    if issues:
        logger.warning("TIER 2 AMBIGUITY IDENTIFIED: %s", issues)
        return {
            "triage_level": "tier_2_ambiguous",
            "dosage_validation_issues": issues,
            "clarification_needed": True,
            "clarification_questions": questions,
            "human_review_required": True,
        }

    return {
        "triage_level": "tier_1_routine",
        "dosage_validation_issues": [],
        "clarification_needed": False,
        "clarification_questions": [],
        "human_review_required": False,
    }
