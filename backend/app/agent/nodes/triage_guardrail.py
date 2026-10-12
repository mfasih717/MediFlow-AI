# -*- coding: utf-8 -*-
r"""MediFlow AI - Triage Guardrail Node (Tier 3 Acute Red-Flag Emergency Detector)
Deterministic, rule-based emergency triage system supporting English, Nastaliq Urdu, and Roman Urdu.
Uses pure unicode escape literals (\uXXXX) for all Urdu patterns for ASCII immunity.
Freezes automated processing immediately upon detecting life-threatening clinical signals.
"""

from typing import Any, Dict, List
import re

from app.agent.state import AgentState
from app.core.config import settings
from app.core.logging import logger
from app.engine.prompts import URDU_EMERGENCY_DIRECTIVE, ENGLISH_EMERGENCY_DIRECTIVE

# Deterministic Clinical Red-Flag Patterns
# Category -> Dict[Language, List of Regex Patterns]
RED_FLAG_PATTERNS = {
    "CARDIAC_ACUTE_CHEST_PAIN": {
        "en": [
            r"\bchest\s+pain\b",
            r"\bangina\b",
            r"\bheart\s+attack\b",
            r"\bmyocardial\s+infarction\b",
            r"\btightness\s+in\s+chest\b",
            r"\bpressure\s+in\s+chest\b",
            r"\bradiating\s+arm\s+pain\b",
            r"\bcrushing\s+substernal\b",
        ],
        "ur": [
            r"\u0633\u06cc\u0646\u06d2\s+\u0645\u06cc\u06ba(?:\s+\S+)?\s+\u062f\u0631\u062f",  # seene mein (shadeed) dard
            r"\u0633\u06cc\u0646\u06c1\s+\u0645\u06cc\u06ba\s+\u062f\u0631\u062f",
            r"\u062f\u0644\s+\u06a9\u0627\s+\u062f\u0648\u0631\u06c1",                         # dil ka daura
            r"\u062f\u0644\s+\u06a9\u0627\s+\u062f\u0648\u0631\u0627",
            r"\u0686\u06be\u0627\u062a\u06cc\s+\u0645\u06cc\u06ba\s+\u062f\u0631\u062f",         # chhati mein dard
            r"\u0633\u06cc\u0646\u06d2\s+\u067e\u0631\s+\u062f\u0628\u0627\u0624",             # seene par dabao
            r"\u067e\u0633\u06cc\u0646\u06c1\s+\u0622\s*\u0631\u06c1\u0627",                  # paseena araha
        ],
        "ur_roman": [
            r"\bseen[ea]y?\s+(?:me|mein)(?:\s+\S+)?\s+dard\b",
            r"\bseene\s+dard\b",
            r"\bdil\s+ka\s+daura\b",
            r"\bdil\s+ka\s+dora\b",
            r"\bch[h]?at[ie]\s+(?:me|mein)(?:\s+\S+)?\s+dard\b",
            r"\bpaseena\s+a\s*raha\b",
            r"\bpasina\s+a\s*raha\b",
            r"\bchest\s+pain\b",
        ],
    },
    "RESPIRATORY_SEVERE_DYSPNEA": {
        "en": [
            r"\bshortness\s+of\s+breath\b",
            r"\bsevere\s+dyspnea\b",
            r"\bcannot\s+breathe\b",
            r"\bchoking\b",
            r"\bstridor\b",
            r"\bgasping\s+for\s+air\b",
            r"\bacute\s+asthma\s+attack\b",
        ],
        "ur": [
            r"\u0633\u0627\u0646\u0633\s+\u06a9\u06cc\s+\u062a\u0646\u06af\u06cc",             # saans ki tangi
            r"\u0633\u0627\u0646\u0633\s+\u0644\u06cc\u0646\u06d2\s+\u0645\u06cc\u06ba(?:\s+\S+)?\s+\u062f\u0634\u0648\u0627\u0631\u06cc", # saans lene mein dushwari
            r"\u062f\u0645\s+\u06af\u06be\u067f\u0646\u0627",                                 # dam ghutna
            r"\u0633\u0627\u0646\u0633\s+\u0628\u0646\u062f",                                 # saans band
            r"\u062f\u0645\s+\u06a9\u0627\s+\u062f\u0648\u0631\u06c1",                         # dam ka daura
            r"\u0633\u0627\u0646\u0633\s+\u067e\u06be\u0648\u0644",                          # saans phool
            r"\u0633\u0627\u0646\u0633\s+\u0646\u06c1\u06cc\u06ba\s+\u0622\s*\u0631\u06c1\u0627", # saans nahi araha
        ],
        "ur_roman": [
            r"\bsaans\s+ki\s+tangi\b",
            r"\bsans\s+ki\s+tangi\b",
            r"\bsans\s+phool\b",
            r"\bsaans\s+phool\b",
            r"\bsaans\s+nahi\s+a\s*raha\b",
            r"\bsaans\s+nahi\s+aa\s*raha\b",
            r"\bsans\s+nahi\s+a\s*raha\b",
            r"\bsans\s+nahi\s+aa\s*raha\b",
            r"\bdam\s+ghut\b",
            r"\bdum\s+ghut\b",
            r"\bshortness\s+of\s+breath\b",
        ],
    },
    "NEUROLOGICAL_STROKE_OR_COMA": {
        "en": [
            r"\bstroke\b",
            r"\bfacial\s+droop\b",
            r"\bslurred\s+speech\b",
            r"\bslurred\s+words\b",
            r"\bslurred\b",
            r"\bloss\s+of\s+speech\b",
            r"\bnumbness\b",
            r"\bface\s+(?:and|or)\s+arm\b",
            r"\bunconscious\b",
            r"\bloss\s+of\s+consciousness\b",
            r"\bfainting\b",
            r"\bfainted\b",
            r"\bseizure\b",
            r"\bhemiplegia\b",
            r"\bunresponsive\b",
        ],
        "ur": [
            r"\u0641\u0627\u0644\u062c",                                                     # falij
            r"\u0628\u06d2\s*\u06c1\u0648\u0634",                                             # behosh
            r"\u0628\u06d2\s*\u06c1\u0648\u0634\u06cc",                                       # behoshi
            r"\u0645\u0646\u06c1\s+\u0679\u06cc\u0698\u06be\u0627",                           # munh teda
            r"\u0632\u0628\u0627\u0646\s+\u0644\u0691\u06a9\u06be\u0691\u0627\u0646\u0627",   # zuban larkharana
            r"\u062f\u0648\u0631\u06d2\s+\u067e\u0691\u0646\u0627",                           # daure parna
        ],
        "ur_roman": [
            r"\bbe\s*hosh\b",
            r"\bbehosh\b",
            r"\bbehoshi\b",
            r"\bfalij\b",
            r"\bmunh\s+teda\b",
            r"\bmunh\s+terha\b",
            r"\bdaura\s+parna\b",
            r"\bdora\s+parna\b",
            r"\bstroke\b",
        ],
    },
    "MASSIVE_HEMORRHAGE": {
        "en": [
            r"\bheavy\s+bleeding\b",
            r"\bbleeding\b",
            r"\bcoughing\s+.*blood\b",
            r"\bcoughing\s+blood\b",
            r"\bvomiting\s+.*blood\b",
            r"\bvomiting\s+blood\b",
            r"\bblood\s+.*vomit",
            r"\bblood\s+vomiting\b",
            r"\bhematemesis\b",
            r"\bhemoptysis\b",
        ],
        "ur": [
            r"\u0634\u062f\u06cc\u062f\s+\u062e\u0648\u0646\s+\u0628\u06c1\u0646\u0627",       # shadeed khoon behna
            r"\u062e\u0648\u0646\s+\u06a9\u06cc\s+\u0627\u0644\u0679\u06cc",                 # khoon ki ulti
            r"\u06a9\u06be\u0627\u0646\u0633\u06cc\s+\u0645\u06cc\u06ba\s+\u062e\u0648\u0646", # khansi mein khoon
            r"\u062e\u0648\u0646\s+\u0628\u06c1\u06c1?\s*\u0631\u06c1\u0627",                 # khoon beh raha
        ],
        "ur_roman": [
            r"\bkhoon\s+ki\s+ulti\b",
            r"\bkhun\s+ki\s+ulti\b",
            r"\bbleeding\b",
            r"\bkhoon\s+beh\s*raha\b",
            r"\bkhoon\s+bah\s*raha\b",
        ],
    },
    "ANAPHYLAXIS_SEVERE_ALLERGY": {
        "en": [
            r"\banaphylaxis\b",
            r"\banaphylactic\b",
            r"\banaphylactic\s+shock\b",
            r"\bthroat\s+swelling\b",
            r"\bswollen\s+tongue\b",
            r"\ballergic\s+shock\b",
            r"\ballergy\b",
        ],
        "ur": [
            r"\u0634\u062f\u06cc\u062f\s+\u0627\u0644\u0631\u062c\u06cc",                     # shadeed allergy
            r"\u0627\u0644\u0631\u062c\u06cc",                                                 # allergy
            r"\u062d\u0644\u0642\s+\u06a9\u06cc\s+\u0633\u0648\u062c\u0646",                 # halaq ki soojan
            r"\u06af\u0644\u0627\s+\u0633\u0648\u062c\s*\u06af\u06cc\u0627",                 # gala sooj gaya
        ],
        "ur_roman": [
            r"\bgala\s+sooj\s+gaya\b",
            r"\bgala\s+sooj\b",
            r"\ballergy\b",
            r"\bsevere\s+allergy\b",
        ],
    },
    "ACUTE_POISONING_OR_OVERDOSE": {
        "en": [
            r"\bpoisoning\b",
            r"\bswallowed\s+poison\b",
            r"\boverdose\b",
            r"\btoxic\s+ingestion\b",
        ],
        "ur": [
            r"\u0632\u06c1\u0631\s+\u06a9\u06be\u0627\s+\u0644\u06cc\u0627",                 # zeher kha liya
            r"\u0632\u06c1\u0631\s+\u062e\u0648\u0631\u06cc",                                 # zeher khori
            r"\u0627\u0648\u0648\u0631\s+\u0688\u0648\u0632",                                 # overdose
            r"\u0632\u06c1\u0631",                                                             # zeher
        ],
        "ur_roman": [
            r"\bzeher\b",
            r"\bzehar\b",
            r"\boverdose\b",
        ],
    },
}


def scan_for_red_flags(text: str) -> List[Dict[str, Any]]:
    """Deterministically evaluates input text against English, Nastaliq Urdu, and Roman Urdu emergency regexes."""
    if not text or not isinstance(text, str):
        return []

    findings: List[Dict[str, Any]] = []
    text_lower = text.lower()

    for category, lang_patterns in RED_FLAG_PATTERNS.items():
        matched = False

        # 1. Check English patterns
        for pattern in lang_patterns.get("en", []):
            match = re.search(pattern, text_lower, re.IGNORECASE)
            if match:
                findings.append({
                    "symptom_key": category,
                    "trigger_keyword": match.group(0),
                    "matched_language": "en",
                    "urgency_level": "CRITICAL_LIFE_THREAT",
                    "recommended_action": "IMMEDIATE_EMERGENCY_CARE_REQUIRED",
                })
                matched = True
                break

        if matched:
            continue

        # 2. Check Roman Urdu patterns
        for pattern in lang_patterns.get("ur_roman", []):
            match = re.search(pattern, text_lower, re.IGNORECASE)
            if match:
                findings.append({
                    "symptom_key": category,
                    "trigger_keyword": match.group(0),
                    "matched_language": "ur_roman",
                    "urgency_level": "CRITICAL_LIFE_THREAT",
                    "recommended_action": "Fori Emergency Rescue (1122) se rabta karein",
                })
                matched = True
                break

        if matched:
            continue

        # 3. Check Nastaliq Urdu patterns
        for pattern in lang_patterns.get("ur", []):
            match = re.search(pattern, text)
            if match:
                findings.append({
                    "symptom_key": category,
                    "trigger_keyword": match.group(0),
                    "matched_language": "ur",
                    "urgency_level": "CRITICAL_LIFE_THREAT",
                    "recommended_action": "\u0641\u0648\u0631\u06cc \u06c1\u0646\u06af\u0627\u0645\u06cc \u0637\u0628\u06cc \u0627\u0645\u062f\u0627\u062f (1122)",
                })
                break

    return findings


# Tier 2 Ambiguity & Illegibility Detection Patterns
AMBIGUITY_PATTERNS = {
    "en": [
        r"\bunreadable\b",
        r"\bblur(?:red)?\b",
        r"\bmissing\s+in\s+prescription\b",
        r"\bmissing\s+dos(?:e|age)\b",
        r"\bmg\s+missing\b",
        r"\bunclear\b",
        r"\billegible\b",
        r"\bnot\s+clear\b",
        r"\bdoubtful\b",
        r"\bcan'?t\s+read\b",
        r"\bcannot\s+read\b",
    ],
    "ur": [
        r"\u062e\u0648\u0631\u0627\u06a9\s+\u0648\u0627\u0636\u062d\s+\u0646\u06c1\u06cc\u06ba", # khorak wazeh nahi
        r"\u062f\u06be\u0646\u062f\u0644\u0627\s+\u067e\u0646",                         # dhundla pan
        r"\u067e\u0691\u06be\u0627\s+\u0646\u06c1\u06cc\u06ba\s+\u062c\u0627\s+\u0631\u06c1\u0627", # parha nahi ja raha
        r"\u0635\u0627\u0641\s+\u0646\u06c1\u06cc\u06ba",                               # saaf nahi
    ],
    "ur_roman": [
        r"\bdose\s+samajh\s+nahi\s+a\s*rahi\b",
        r"\bdose\s+samajh\s+nahi\b",
        r"\bdose\s+samaj\s+nahi\b",
        r"\bdhundla\b",
        r"\bparchi\s+pe\s+likha.*dose\b",
        r"\bsamajh\s+nahi\s+a\s*rahi\b",
        r"\bwazeh\s+nahi\b",
        r"\bclear\s+nahi\b",
    ],
}


def scan_for_ambiguity(text: str) -> bool:
    """Detects whether user query or prescription indicates illegibility, missing dosage, or ambiguity (Tier 2)."""
    if not text or not isinstance(text, str):
        return False
    text_lower = text.lower()
    for lang, patterns in AMBIGUITY_PATTERNS.items():
        for pattern in patterns:
            if lang == "ur":
                if re.search(pattern, text):
                    return True
            else:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    return True
    return False


async def triage_guardrail_node(state: AgentState) -> Dict[str, Any]:
    """LangGraph node: Evaluates patient text / OCR document for deterministic Tier 3 emergencies."""
    # Check both raw_text and recent chat messages
    text_to_check = state.get("raw_text", "") or ""
    messages = state.get("messages", [])
    if messages:
        last_msg = messages[-1].get("content", "")
        text_to_check += f" {last_msg}"

    findings = scan_for_red_flags(text_to_check)

    if findings:
        logger.critical(
            "TIER 3 RED-FLAG TRIGGERED! Symptoms: %s",
            [f["symptom_key"] for f in findings],
        )
        return {
            "triage_level": "tier_3_acute_emergency",
            "is_emergency": True,
            "red_flags": findings,
            "emergency_escalation_details": {
                "contacts": [settings.EMERGENCY_CONTACT_NUMBER, settings.EMERGENCY_ALT_CONTACT],
                "urdu_directive": URDU_EMERGENCY_DIRECTIVE,
                "english_directive": ENGLISH_EMERGENCY_DIRECTIVE,
                "symptoms_identified": [f["symptom_key"] for f in findings],
            },
            "urdu_explanation": URDU_EMERGENCY_DIRECTIVE,
            "english_explanation": ENGLISH_EMERGENCY_DIRECTIVE,
            "clarification_needed": False,
        }

    # If no red flag was identified, retain current level or set to routine
    current_tier = state.get("triage_level")
    return {
        "triage_level": current_tier if current_tier else "tier_1_routine",
        "is_emergency": False,
        "red_flags": [],
    }
