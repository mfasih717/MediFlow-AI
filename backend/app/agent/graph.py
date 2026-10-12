# -*- coding: utf-8 -*-
"""MediFlow AI - LangGraph Clinical Orchestration Graph
Assembles a cyclic StateGraph executing:
Ingestion -> OCR -> Clinical Reasoning -> Dosage Validator -> Conditional Routing
(Emergency Lock [Tier 3] | Human Clarification [Tier 2] | Urdu Localization & Timeline [Tier 1])
"""

from typing import Any, Dict, Literal
from langgraph.graph import StateGraph, START, END

from app.agent.state import AgentState
from app.agent.nodes.ocr_parser import ocr_parser_node
from app.agent.nodes.clinical_reasoning import clinical_reasoning_node
from app.agent.nodes.dosage_validator import dosage_validator_node
from app.agent.nodes.triage_guardrail import triage_guardrail_node
from app.agent.nodes.urdu_translator import urdu_translator_node
from app.core.logging import logger
from app.engine.prompts import (
    URDU_EMERGENCY_DIRECTIVE,
    ENGLISH_EMERGENCY_DIRECTIVE,
)

# FIX MED-3: Maximum number of human-review cycles allowed before forcing END to prevent infinite loop.
MAX_CLARIFICATION_CYCLES = 3


async def emergency_lock_node(state: AgentState) -> Dict[str, Any]:
    """Terminal node for Tier 3: Freezes all automated scheduling and reinforces emergency directive."""
    logger.critical("PIPELINE FROZEN: Patient is in acute medical emergency state.")
    return {
        "is_emergency": True,
        "triage_level": "tier_3_acute_emergency",
        "english_explanation": ENGLISH_EMERGENCY_DIRECTIVE,
        "urdu_explanation": URDU_EMERGENCY_DIRECTIVE,
        "timeline_schedule": [],  # Halt automated scheduling for clinical safety
    }


async def human_review_node(state: AgentState) -> Dict[str, Any]:
    """Terminal node for Tier 2: Halts automated scheduling and formats clarification inquiries."""
    logger.warning("PIPELINE PAUSED: Prescription ambiguity requires clinical or patient clarification.")
    # FIX MED-3: Track how many times we've cycled through human review.
    current_cycle = state.get("clarification_cycle_count", 0) + 1

    en_expl = state.get("english_explanation") or (
        "Prescription details require clinical verification. "
        "Please provide a clearer scan or consult your prescribing physician or pharmacist regarding the exact dosage."
    )
    ur_expl = state.get("urdu_explanation") or (
        "\u0646\u0633\u062e\u06d2 \u06a9\u06cc \u06c1\u062f\u0627\u06cc\u0627\u062a \u0645\u0634\u06a9\u0648\u06a9 \u06cc\u0627 \u063a\u06cc\u0631 \u0648\u0627\u0636\u062d \u06c1\u06cc\u06ba\u06d4 "
        "\u0628\u0631\u0627\u06c1 \u06a9\u0631\u0645 \u062f\u0648\u0627 \u0644\u06cc\u0646\u06d2 \u0633\u06d2 \u0642\u0628\u0644 \u0688\u0627\u06a9\u0679\u0631 \u06cc\u0627 \u0641\u0627\u0631\u0645\u0627\u0633\u0633\u0679 \u0633\u06d2 \u062e\u0648\u0631\u0627\u06a9 \u06a9\u06cc \u062a\u0635\u062f\u06cc\u0642 \u06a9\u0631\u06cc\u06ba\u06d4"
    )

    return {
        "human_review_required": True,
        "clarification_cycle_count": current_cycle,
        "english_explanation": en_expl,
        "urdu_explanation": ur_expl,
        "timeline_schedule": [],  # Do not publish automated medication timetable until verified
    }


def route_after_triage(state: AgentState) -> Literal["emergency_lock", "ocr_parser"]:
    """Conditional edge: Immediately freezes pipeline if emergency symptoms are detected."""
    if state.get("is_emergency") or state.get("triage_level") == "tier_3_acute_emergency":
        return "emergency_lock"
    return "ocr_parser"


def route_after_dosage_check(
    state: AgentState,
) -> Literal["emergency_lock", "human_review", "urdu_translator"]:
    """Conditional edge: Routes based on clinical safety tier."""
    if state.get("is_emergency") or state.get("triage_level") == "tier_3_acute_emergency":
        return "emergency_lock"

    if state.get("clarification_needed") or state.get("triage_level") == "tier_2_ambiguous":
        return "human_review"

    return "urdu_translator"


def route_after_human_review(state: AgentState) -> Literal["clinical_reasoning", "__end__"]:
    """FIX MED-3: Cyclic edge with a hard iteration cap to prevent infinite loops.

    Loops back to clinical reasoning only if:
    1. A clarification reply was received (last message is from user, and we have > 1 messages), AND
    2. We have not exceeded MAX_CLARIFICATION_CYCLES.
    """
    messages = state.get("messages", [])
    cycle_count = state.get("clarification_cycle_count", 0)

    # Hard cap — terminate regardless after MAX_CLARIFICATION_CYCLES to prevent infinite loops
    if cycle_count >= MAX_CLARIFICATION_CYCLES:
        logger.warning(
            "Max clarification cycles (%d) reached. Terminating pipeline.", MAX_CLARIFICATION_CYCLES
        )
        return "__end__"

    # Only loop back if a new user clarification reply was received
    if messages and messages[-1].get("role") == "user" and len(messages) > 1:
        logger.info("Clarification answer received; cycling back to clinical reasoning (cycle %d).", cycle_count)
        return "clinical_reasoning"

    return "__end__"


def create_mediflow_graph() -> StateGraph:
    """Builds and compiles the production LangGraph state machine."""
    workflow = StateGraph(AgentState)

    # Register all nodes
    workflow.add_node("triage_guardrail", triage_guardrail_node)
    workflow.add_node("ocr_parser", ocr_parser_node)
    workflow.add_node("clinical_reasoning", clinical_reasoning_node)
    workflow.add_node("dosage_validator", dosage_validator_node)
    workflow.add_node("urdu_translator", urdu_translator_node)
    workflow.add_node("emergency_lock", emergency_lock_node)
    workflow.add_node("human_review", human_review_node)

    # Connect START to initial triage check
    workflow.add_edge(START, "triage_guardrail")

    # Conditional edge after initial triage
    workflow.add_conditional_edges(
        "triage_guardrail",
        route_after_triage,
        {
            "emergency_lock": "emergency_lock",
            "ocr_parser": "ocr_parser",
        },
    )

    # Linear flow: OCR -> Clinical Reasoning -> Dosage Validation
    workflow.add_edge("ocr_parser", "clinical_reasoning")
    workflow.add_edge("clinical_reasoning", "dosage_validator")

    # Conditional edge after dosage validation
    workflow.add_conditional_edges(
        "dosage_validator",
        route_after_dosage_check,
        {
            "emergency_lock": "emergency_lock",
            "human_review": "human_review",
            "urdu_translator": "urdu_translator",
        },
    )

    # Cyclic edge from human review — now bounded by MAX_CLARIFICATION_CYCLES
    workflow.add_conditional_edges(
        "human_review",
        route_after_human_review,
        {
            "clinical_reasoning": "clinical_reasoning",
            "__end__": END,
        },
    )

    # Terminal connections
    workflow.add_edge("emergency_lock", END)
    workflow.add_edge("urdu_translator", END)

    return workflow


# Compiled singleton graph
mediflow_graph = create_mediflow_graph().compile()
