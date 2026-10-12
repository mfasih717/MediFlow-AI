# -*- coding: utf-8 -*-
"""MediFlow AI - Bilingual Patient Chat & Clinical Consultation Service
Handles real-time conversation, intent triage, emergency detection, and AMD ROCm LLM completions.
All Urdu literals use pure Unicode escape sequences (\\uXXXX) to guarantee 100% ASCII compatibility.
"""

from typing import AsyncGenerator, Dict, List, Optional
import json

from app.agent.nodes.triage_guardrail import scan_for_red_flags, scan_for_ambiguity
from app.core.logging import logger
from app.core.security import anonymize_text_for_llm
from app.engine.prompts import (
    URDU_EMERGENCY_DIRECTIVE,
    ENGLISH_EMERGENCY_DIRECTIVE,
)
from app.engine.vllm_client import vllm_client
from app.schemas.chat import ChatHistoryEntry, ChatRequest, ChatResponse
from app.schemas.triage import TriageTier, RedFlagFinding

CHAT_SYSTEM_PROMPT = (
    "You are MediFlow AI, an intelligent, empathetic bilingual Clinical Co-Pilot and Patient Journey Assistant running on local AMD ROCm hardware.\n"
    "You communicate fluently in both English and natural Nastaliq Urdu.\n\n"
    "Guidelines:\n"
    "1. Always maintain clinical accuracy and compassion.\n"
    "2. If the user asks about taking medicines, remind them of meal relations (before/after food) and correct timing.\n"
    "3. If their request is ambiguous or they describe uncommon symptoms, politely ask for clarification.\n"
    "4. Output your response formatted as a JSON object with two fields:\n"
    '   "reply_english": "Your clear, empathetic response in English",\n'
    '   "reply_urdu": "\\u0622\\u067e \\u06a9\\u0627 \\u0645\\u06a9\\u0645\\u0644\\u060c \\u0634\\u0627\\u0626\\u0633\\u062a\\u06c1 \\u0627\\u0648\\u0631 \\u062f\\u0631\\u0633\\u062a \\u062c\\u0648\\u0627\\u0628 \\u0627\\u0631\\u062f\\u0648 \\u0646\\u0633\\u062a\\u0639\\u0644\\u06cc\\u0642 \\u0645\\u06cc\\u06ba"\n'
)


class ChatService:
    """Manages bilingual triage and patient conversation logic."""

    async def process_chat(self, request: ChatRequest) -> ChatResponse:
        """Processes a patient chat turn with deterministic Tier 3 emergency triage."""
        user_msg = request.message.strip()

        # STEP 1: DETERMINISTIC TIER 3 RED-FLAG TRIAGE GUARDRAIL
        findings = scan_for_red_flags(user_msg)
        if findings:
            logger.critical("TIER 3 RED-FLAG DETECTED IN CHAT: %s", [f["symptom_key"] for f in findings])
            red_flag_objs = [RedFlagFinding(**f) for f in findings]
            return ChatResponse(
                reply_english=ENGLISH_EMERGENCY_DIRECTIVE,
                reply_urdu=URDU_EMERGENCY_DIRECTIVE,
                triage_tier=TriageTier.TIER_3_ACUTE_EMERGENCY,
                is_emergency=True,
                red_flag_findings=red_flag_objs,
                emergency_contact="1122",
                clarification_required=False,
                suggested_quick_replies=[
                    "Call 1122 Now",
                    "Nearest Emergency Hospital",
                    "I am sitting and resting",
                ],
            )

        # STEP 1.5: TIER 2 AMBIGUITY / ILLEGIBLE PRESCRIPTION / MISSING DOSAGE GUARDRAIL
        if scan_for_ambiguity(user_msg):
            logger.info("TIER 2 AMBIGUITY / CLARIFICATION TRIGGERED FOR CHAT: %s", user_msg[:80])
            return ChatResponse(
                reply_english=(
                    "The prescription or dosage detail in your request is unclear or partially illegible. "
                    "For your clinical safety, please upload a clearer scan or consult your prescribing doctor "
                    "or pharmacist to verify the exact strength and frequency before taking this medication."
                ),
                reply_urdu=(
                    "\u0622\u067e \u06a9\u06d2 \u0646\u0633\u062e\u06d2 \u0645\u06cc\u06ba \u062f\u0648\u0627 \u06a9\u06cc \u062e\u0648\u0631\u0627\u06a9 \u06cc\u0627 \u06c1\u062f\u0627\u06cc\u0627\u062a \u0648\u0627\u0636\u062d \u0646\u06c1\u06cc\u06ba \u06c1\u06cc\u06ba\u06d4 "
                    "\u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u0627\u067e\u0646\u06cc \u0635\u062d\u062a \u06a9\u06cc \u062d\u0641\u0627\u0638\u062a \u06a9\u06d2 \u0644\u0626\u06d2 \u0635\u0627\u0641 \u062a\u0635\u0648\u06cc\u0631 \u0628\u06be\u06cc\u062c\u06cc\u06ba \u06cc\u0627 \u0688\u0627\u06a9\u0679\u0631 \u0633\u06d2 \u0631\u0627\u0628\u0637\u06c1 \u06a9\u0631\u06cc\u06ba\u06d4"
                ),
                triage_tier=TriageTier.TIER_2_AMBIGUOUS,
                is_emergency=False,
                red_flag_findings=[],
                emergency_contact=None,
                clarification_required=True,
                suggested_quick_replies=[
                    "Upload Clear Scan",
                    "Contact Doctor",
                    "Verify Dosage with Pharmacist",
                ],
            )

        # STEP 2: BUILD CONVERSATION CONTEXT & SANITIZE PHI
        sanitized_msg = anonymize_text_for_llm(user_msg)
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": CHAT_SYSTEM_PROMPT}
        ]

        # Add recent conversation history (up to last 6 turns)
        for turn in request.history[-6:]:
            messages.append({"role": turn.role, "content": anonymize_text_for_llm(turn.content)})

        messages.append({"role": "user", "content": sanitized_msg})

        # STEP 3: AMD ROCm vLLM INFERENCE
        reply_en = "Thank you for reaching out. Please take your prescribed medications on time with water, and let me know if you experience any unexpected side effects."
        reply_ur = "\u0631\u0627\u0628\u0637\u06c1 \u06a9\u0631\u0646\u06d2 \u06a9\u0627 \u0634\u06a9\u0631\u06cc\u06c1\u06d4 \u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u0627\u067e\u0646\u06cc \u0627\u062f\u0648\u06cc\u0627\u062a \u0648\u0642\u062a \u067e\u0631 \u067e\u0627\u0646\u06cc \u06a9\u06d2 \u0633\u0627\u062a\u06be \u0644\u06cc\u06ba\u060c \u0627\u0648\u0631 \u0627\u06af\u0631 \u06a9\u0648\u0626\u06cc \u063a\u06cc\u0631 \u0645\u0639\u0645\u0648\u0644\u06cc \u0639\u0644\u0627\u0645\u062a \u0645\u062d\u0633\u0648\u0633 \u06c1\u0648 \u062a\u0648 \u0641\u0648\u0631\u0627\u064b \u0645\u0637\u0644\u0639 \u0641\u0631\u0645\u0627\u0626\u06cc\u06ba\u06d4"

        try:
            llm_response = await vllm_client.chat_completion(
                messages=messages,
                temperature=0.3,
                max_tokens=1024,
            )
            # Try parsing bilingual JSON
            cleaned = llm_response.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0].strip()

            if cleaned.startswith("{") and cleaned.endswith("}"):
                data = json.loads(cleaned)
                reply_en = data.get("reply_english", reply_en)
                reply_ur = data.get("reply_urdu", reply_ur)
            else:
                # If plain text returned
                reply_en = llm_response
                reply_ur = llm_response
        except Exception as exc:
            logger.warning("Local vLLM chat completion error (%s); falling back to clinical default responses.", exc)

        return ChatResponse(
            reply_english=reply_en,
            reply_urdu=reply_ur,
            triage_tier=TriageTier.TIER_1_ROUTINE,
            is_emergency=False,
            red_flag_findings=[],
            emergency_contact=None,
            clarification_required=False,
            suggested_quick_replies=[
                "Check today's medicines",
                "How to take Panadol?",
                "\u06a9\u06be\u0627\u0646\u06d2 \u0633\u06d2 \u067e\u06c1\u0644\u06d2 \u06cc\u0627 \u0628\u0639\u062f \u0645\u06cc\u06ba\u061f",
            ],
        )

    async def stream_chat_tokens(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        """Streams raw tokens for WebSocket or Server-Sent Events."""
        # Check red flags first
        findings = scan_for_red_flags(request.message)
        if findings:
            yield URDU_EMERGENCY_DIRECTIVE
            return

        messages = [
            {"role": "system", "content": "You are MediFlow AI, an empathetic bilingual clinical co-pilot."},
            {"role": "user", "content": request.message},
        ]
        async for token in vllm_client.stream_chat_completion(messages):
            yield token


chat_service = ChatService()
