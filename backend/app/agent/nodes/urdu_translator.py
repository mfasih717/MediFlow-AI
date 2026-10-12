# -*- coding: utf-8 -*-
"""MediFlow AI - Urdu Translator & Patient Care Journey Node
Generates empathetic, authentic Nastaliq Urdu instructions, English layman summaries,
and structured medication timeline schedule items.
All Urdu literals use pure Unicode escape sequences (\\uXXXX) to guarantee 100% ASCII compatibility.
"""

from typing import Any, Dict, List
import json
import re
import uuid

from app.agent.state import AgentState
from app.core.logging import logger
from app.engine.prompts import (
    URDU_LOCALIZATION_SYSTEM_PROMPT,
    URDU_LOCALIZATION_USER_PROMPT,
)
from app.engine.vllm_client import vllm_client


def _generate_timeline_slots(medications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Converts clinical frequencies into daily scheduled dose slots."""
    timeline: List[Dict[str, Any]] = []

    for med in medications:
        brand = med.get("brand_name", "Medication")
        salt = med.get("generic_salt", "")
        strength = med.get("dosage_strength", "")
        freq = (med.get("frequency", "") or "").lower()

        slots: List[Dict[str, str]] = []
        if "three" in freq or "tds" in freq or "tid" in freq or "8 hour" in freq:
            slots = [
                ("morning", "08:00", "after_meals", "Take after breakfast with water", "\u0635\u0628\u062d \u0646\u0627\u0634\u062a\u06d2 \u06a9\u06d2 \u0628\u0639\u062f \u067e\u0627\u0646\u06cc \u06a9\u06d2 \u0633\u0627\u062a\u06be \u0644\u06cc\u06ba"),
                ("afternoon", "14:00", "after_meals", "Take after lunch with water", "\u062f\u0648\u067e\u06c1\u0631 \u06a9\u06be\u0627\u0646\u06d2 \u06a9\u06d2 \u0628\u0639\u062f \u067e\u0627\u0646\u06cc \u06a9\u06d2 \u0633\u0627\u062a\u06be \u0644\u06cc\u06ba"),
                ("evening", "20:00", "after_meals", "Take after dinner with water", "\u0631\u0627\u062a \u06a9\u06be\u0627\u0646\u06d2 \u06a9\u06d2 \u0628\u0639\u062f \u067e\u0627\u0646\u06cc \u06a9\u06d2 \u0633\u0627\u062a\u06be \u0644\u06cc\u06ba"),
            ]
        elif "twice" in freq or "bd" in freq or "bid" in freq or "12 hour" in freq:
            slots = [
                ("morning", "08:00", "after_meals", "Take 1 dose after breakfast", "\u0635\u0628\u062d \u0646\u0627\u0634\u062a\u06d2 \u06a9\u06d2 \u0628\u0639\u062f \u0627\u06cc\u06a9 \u062e\u0648\u0631\u0627\u06a9 \u0644\u06cc\u06ba"),
                ("evening", "20:00", "after_meals", "Take 1 dose after dinner", "\u0631\u0627\u062a \u06a9\u06be\u0627\u0646\u06d2 \u06a9\u06d2 \u0628\u0639\u062f \u0627\u06cc\u06a9 \u062e\u0648\u0631\u0627\u06a9 \u0644\u06cc\u06ba"),
            ]
        elif "night" in freq or "bed" in freq:
            slots = [
                ("night", "22:00", "before_sleep", "Take at bedtime", "\u0633\u0648\u062a\u06d2 \u0648\u0642\u062a \u0627\u06cc\u06a9 \u062e\u0648\u0631\u0627\u06a9 \u0644\u06cc\u06ba"),
            ]
        elif "empty" in freq or "before breakfast" in freq:
            slots = [
                ("morning", "07:30", "empty_stomach", "Take 30 mins before breakfast", "\u0635\u0628\u062d \u0646\u0627\u0634\u062a\u06d2 \u0633\u06d2 \u0622\u062f\u06be\u0627 \u06af\u06be\u0646\u0679\u06c1 \u0642\u0628\u0644 \u062e\u0627\u0644\u06cc \u067e\u06cc\u0679 \u0644\u06cc\u06ba"),
            ]
        else:  # Default once daily
            slots = [
                ("morning", "08:00", "after_meals", "Take once daily in the morning", "\u0631\u0648\u0632\u0627\u0646\u06c1 \u0635\u0628\u062d \u06a9\u06d2 \u0648\u0642\u062a \u0627\u06cc\u06a9 \u062e\u0648\u0631\u0627\u06a9 \u0644\u06cc\u06ba"),
            ]

        for time_slot, sched_time, meal_rel, en_note, ur_note in slots:
            timeline.append({
                "dose_id": f"dose-{uuid.uuid4().hex[:8]}",
                "medication_name": brand,
                "generic_salt": salt,
                "strength": strength,
                "time_slot": time_slot,
                "scheduled_time": sched_time,
                "meal_relation": meal_rel,
                "english_instruction": f"{brand} ({strength}) - {en_note}",
                "urdu_instruction": f"{brand} ({strength}) - {ur_note}",
                "status": "scheduled",
            })

    # Sort chronologically by scheduled_time
    timeline.sort(key=lambda x: x["scheduled_time"])
    return timeline


def _deterministic_urdu_summary(medications: List[Dict[str, Any]]) -> str:
    """Generates pure, natural Nastaliq Urdu instructions without LLM dependency."""
    lines = [
        "\u0622\u067e \u06a9\u06d2 \u0637\u0628\u06cc \u0646\u0633\u062e\u06d2 \u06a9\u06cc \u0622\u0633\u0627\u0646 \u0627\u0648\u0631 \u062a\u0641\u0635\u06cc\u0644\u06cc \u0631\u06c1\u0646\u0645\u0627\u0626\u06cc \u062f\u0631\u062c \u0630\u06cc\u0644 \u06c1\u06d2:\n"
    ]
    for idx, med in enumerate(medications, start=1):
        brand = med.get("brand_name", "")
        salt = med.get("generic_salt", "")
        strength = med.get("dosage_strength", "")
        freq = med.get("frequency", "")
        inst_ur = med.get("instructions_urdu") or "\u0637\u0628\u06cc\u0628 \u06a9\u06cc \u06c1\u062f\u0627\u06cc\u062a \u06a9\u06d2 \u0645\u0637\u0627\u0628\u0642 \u0627\u0633\u062a\u0639\u0645\u0627\u0644 \u06a9\u0631\u06cc\u06ba\u06d4"

        salt_desc = f" ({salt})" if salt else ""
        lines.append(f"{idx}. \u062f\u0648\u0627: {brand}{salt_desc}")
        if strength:
            lines.append(f"   \u0645\u0642\u062f\u0627\u0631: {strength}")
        if freq:
            lines.append(f"   \u062a\u0639\u062f\u0627\u062f: {freq}")
        lines.append(f"   \u0637\u0631\u06cc\u0642\u06c1 \u0627\u0633\u062a\u0639\u0645\u0627\u0644: {inst_ur}\n")

    lines.append("\u0627\u062d\u062a\u06cc\u0627\u0637: \u0627\u062f\u0648\u06cc\u0627\u062a \u0648\u0642\u062a \u067e\u0631 \u0644\u06cc\u06ba \u0627\u0648\u0631 \u06a9\u0648\u0626\u06cc \u0628\u06be\u06cc \u062e\u0648\u0631\u0627\u06a9 \u0686\u06be\u0648\u0679 \u062c\u0627\u0646\u06d2 \u06a9\u06cc \u0635\u0648\u0631\u062a \u0645\u06cc\u06ba \u062f\u06c1\u0631\u06cc \u062e\u0648\u0631\u0627\u06a9 \u06c1\u0631\u06af\u0632 \u0646\u06c1 \u0644\u06cc\u06ba\u06d4")
    return "\n".join(lines)


def _deterministic_english_summary(medications: List[Dict[str, Any]]) -> str:
    """Generates plain English patient instructions."""
    lines: List[str] = [
        "Here is the simple guide for your prescribed medications:\n"
    ]
    for idx, med in enumerate(medications, start=1):
        brand = med.get("brand_name", "")
        salt = med.get("generic_salt", "")
        strength = med.get("dosage_strength", "")
        freq = med.get("frequency", "")
        inst_en = med.get("instructions_english") or "Take as advised by your physician."

        salt_desc = f" ({salt})" if salt else ""
        lines.append(f"{idx}. {brand}{salt_desc} [{strength}]")
        lines.append(f"   Schedule: {freq}")
        lines.append(f"   Directions: {inst_en}\n")

    lines.append("Important: Maintain adequate hydration and do not exceed prescribed dosages.")
    return "\n".join(lines)


def _parse_llm_bilingual_response(response: str) -> tuple:
    """FIX BUG-1: Parse the LLM bilingual response into separate English and Urdu strings.

    The LLM is instructed to return numbered sections. We try to split them.
    Returns (english_text, urdu_text) or (None, None) if parsing fails.
    """
    # Try JSON first
    try:
        cleaned = response.strip()
        if cleaned.startswith("{"):
            data = json.loads(cleaned)
            en = data.get("english_explanation") or data.get("reply_english")
            ur = data.get("urdu_explanation") or data.get("reply_urdu")
            if en and ur:
                return en, ur
    except Exception:
        pass

    # Try section-based split on "1. English" / "2. Urdu" markers
    en_match = re.search(
        r"1\.\s*English[^:]*:(.*?)(?=2\.|$)", response, re.DOTALL | re.IGNORECASE
    )
    ur_match = re.search(
        r"2\.\s*(?:Urdu|\u0627\u0631\u062f\u0648)[^:]*:(.*?)$", response, re.DOTALL | re.IGNORECASE
    )
    if en_match and ur_match:
        return en_match.group(1).strip(), ur_match.group(1).strip()

    return None, None


async def urdu_translator_node(state: AgentState) -> Dict[str, Any]:
    """LangGraph node: Generates bilingual explanations and medication schedule."""
    medications = state.get("extracted_medications", [])
    if not medications:
        return {
            "urdu_explanation": "\u06a9\u0648\u0626\u06cc \u062f\u0648\u0627 \u0634\u0646\u0627\u062e\u062a \u0646\u06c1\u06cc\u06ba \u06c1\u0648\u0626\u06cc\u06d4",
            "english_explanation": "No medications identified.",
            "timeline_schedule": [],
        }

    # Generate daily schedule slots
    timeline = _generate_timeline_slots(medications)

    # Prepare summary for prompt
    meds_summary = "\n".join([
        f"- {m.get('brand_name')} ({m.get('generic_salt')}): {m.get('dosage_strength')}, {m.get('frequency')}"
        for m in medications
    ])

    # Start with reliable deterministic summaries as defaults
    urdu_text = _deterministic_urdu_summary(medications)
    english_text = _deterministic_english_summary(medications)

    # FIX BUG-1: Optionally enhance via local AMD ROCm vLLM — parse response properly into two fields.
    try:
        prompt = URDU_LOCALIZATION_USER_PROMPT.format(medications_summary=meds_summary)
        messages = [
            {"role": "system", "content": URDU_LOCALIZATION_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
        response = await vllm_client.chat_completion(
            messages=messages,
            temperature=0.2,
            max_tokens=1024,
            retries=0,
        )
        if response and len(response) > 50:
            parsed_en, parsed_ur = _parse_llm_bilingual_response(response)
            if parsed_en and parsed_ur:
                # Only replace if both sections were successfully parsed
                english_text = parsed_en
                urdu_text = parsed_ur
            # If parsing fails, deterministic templates remain as fallback (do NOT assign raw response to both)
    except Exception as exc:
        logger.debug("Local vLLM bilingual formatting skipped (%s); using deterministic templates.", exc)

    return {
        "urdu_explanation": urdu_text,
        "english_explanation": english_text,
        "timeline_schedule": timeline,
    }
