# -*- coding: utf-8 -*-
"""MediFlow AI - Dosage Validator Node (Tier 2 Clinical Ambiguity & Safety Guard)
Applies deterministic pharmacological bounds, checks OCR confidence integrity,
and generates bilingual clarification queries when safety standards are breached.
"""

from typing import Any, Dict, List
import re

from app.agent.state import AgentState
from app.core.config import settings
from app.core.logging import logger

# Maximum safe single/daily doses for common medications
MAX_DAILY_SAFE_DOSE = {
    "paracetamol": 4000,   # 4000mg (4g) per day
    "acetaminophen": 4000,
    "metformin": 2550,     # 2550mg per day
    "aspirin": 4000,       # 4000mg per day
    "bisoprolol": 20,      # 20mg per day
    "esomeprazole": 80,    # 80mg per day
    "ibuprofen": 3200,     # 3200mg per day
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


async def dosage_validator_node(state: AgentState) -> Dict[str, Any]:
    """LangGraph node: Validates medication safety, dosage bounds, and OCR clarity."""
    # Never downgrade an already detected Tier 3 Acute Emergency
    if state.get("is_emergency") or state.get("triage_level") == "tier_3_acute_emergency":
        return {
            "clarification_needed": False,
            "human_review_required": True,
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
        questions.append("براہ کرم نسخے کی واضح تصویر فراہم کریں یا دواؤں کے ناموں کی تصدیق فرمائیں۔")

    # 2. Empty medication extraction check
    if not medications and state.get("raw_text", "").strip():
        issues.append("Document text contains content, but no standard pharmaceutical medications could be verified.")
        questions.append("We could not reliably identify the medication names. Please verify with your doctor or pharmacist.")
        questions.append("دوا کا نام واضح طور پر نہیں پڑھا جا سکا۔ براہ کرم ڈاکٹر یا فارماسسٹ سے تصدیق کریں۔")

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
            questions.append(f"براہ کرم دوا '{brand}' کی پوٹینسی (مثلاً 500mg) کی تصدیق فرمائیں۔")
            med["ambiguity_flags"].append("Missing dosage strength")

        # Check missing frequency instructions
        if not freq or freq.lower() in ["unknown", "none", ""]:
            issues.append(f"Missing frequency instructions for medication: {brand}")
            questions.append(f"How many times a day did your doctor advise taking {brand}?")
            questions.append(f"ڈاکٹر نے '{brand}' دن میں کتنی بار لینے کا مشورہ دیا ہے؟")
            med["ambiguity_flags"].append("Missing frequency instruction")

        # Check dangerous overdose bounds
        mg_val = _parse_mg_strength(strength)
        for drug_key, max_safe in MAX_DAILY_SAFE_DOSE.items():
            if drug_key in salt:
                if mg_val > max_safe:
                    warning_msg = (
                        f"DANGER: {brand} ({salt.capitalize()}) dosage {mg_val}mg exceeds maximum recommended daily bound ({max_safe}mg)."
                    )
                    issues.append(warning_msg)
                    med["safety_warnings"].append(warning_msg)
                    questions.append(
                        f"The prescribed dose of {brand} ({mg_val}mg) appears unusually high. Please confirm with your prescribing physician immediately."
                    )
                    questions.append(
                        f"توجہ فرمائیں: {brand} کی مقدار معمول سے زیادہ معلوم ہوتی ہے۔ برائے مہربانی فوری طور پر اپنے ڈاکٹر سے تصدیق کریں۔"
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
