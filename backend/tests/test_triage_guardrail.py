# -*- coding: utf-8 -*-
"""MediFlow AI - Unit Tests for Triage Guardrail & Red-Flag Clinical Detection
Validates deterministic triage triggers across English, Nastaliq Urdu, and Roman Urdu.
"""

import pytest
from app.agent.nodes.triage_guardrail import scan_for_red_flags, scan_for_ambiguity


def test_cardiac_red_flags_english():
    queries = [
        "Patient has severe chest pain radiating to left arm",
        "Experiencing acute heart attack symptoms",
        "Crushing substernal pressure and pain",
    ]
    for q in queries:
        findings = scan_for_red_flags(q)
        assert len(findings) > 0, f"Expected red flag for: {q}"
        assert any("CARDIAC" in f["symptom_key"] for f in findings)


def test_cardiac_red_flags_urdu_nastaliq():
    queries = [
        "سینے میں شدید درد اور پسینہ آ رہا ہے",
        "دل کا دورہ پڑنے کا خدشہ ہے",
        "چھاتی میں درد اور سانس رک رہی ہے",
    ]
    for q in queries:
        findings = scan_for_red_flags(q)
        assert len(findings) > 0, f"Expected red flag for: {q}"


def test_cardiac_red_flags_roman_urdu():
    queries = [
        "Seene me shadeed dard aur paseena araha hai",
        "Dil ka daura par gaya hai shayad",
        "Chati me dard hai",
    ]
    for q in queries:
        findings = scan_for_red_flags(q)
        assert len(findings) > 0, f"Expected red flag for: {q}"


def test_respiratory_red_flags_multilingual():
    # English
    assert len(scan_for_red_flags("Acute shortness of breath and choking")) > 0
    # Urdu Nastaliq
    assert len(scan_for_red_flags("سانس کی تنگی اور دم گھٹ رہا ہے")) > 0
    # Roman Urdu
    assert len(scan_for_red_flags("Saans ki tangi hai aur dam ghut raha hai")) > 0


def test_neurological_red_flags_multilingual():
    # English
    assert len(scan_for_red_flags("Sudden facial droop and slurred speech")) > 0
    # Urdu Nastaliq
    assert len(scan_for_red_flags("مریض بے ہوش ہے اور زبان لڑکھڑا رہی ہے")) > 0
    # Roman Urdu
    assert len(scan_for_red_flags("Behosh hogaya hai aur munh teda hai")) > 0


def test_hemorrhage_red_flags_multilingual():
    # English
    assert len(scan_for_red_flags("Vomiting large amounts of blood")) > 0
    # Urdu Nastaliq
    assert len(scan_for_red_flags("شدید خون بہہ رہا ہے اور خون کی الٹی ہے")) > 0
    # Roman Urdu
    assert len(scan_for_red_flags("Khoon ki ulti arahi hai")) > 0


def test_ambiguity_scanner():
    # English
    assert scan_for_ambiguity("Panadol 500mg ... frequency unreadable blurred scan") is True
    assert scan_for_ambiguity("Tab Augmentin mg missing in prescription") is True
    # Urdu Nastaliq
    assert scan_for_ambiguity("خوراک واضح نہیں ہے دھندلا پن ہے") is True
    # Roman Urdu
    assert scan_for_ambiguity("Doctor ne parchi pe likha hai lkn dose samajh nahi arahi") is True


def test_benign_routine_queries_do_not_trigger():
    benign = [
        "Take Paracetamol 500mg 1 tablet after meals twice daily",
        "Discharge summary: Omeprazole 20mg morning before breakfast for 14 days",
        "Panadol goli subah sham khane k baad leni hai",
        "Explain lipid panel report: Cholesterol is 185 mg/dL",
        "Blood test result: Hemoglobin 14.2 g/dL benign markers",
    ]
    for b in benign:
        assert len(scan_for_red_flags(b)) == 0, f"False positive red flag for: {b}"
        assert scan_for_ambiguity(b) is False, f"False positive ambiguity for: {b}"
