# -*- coding: utf-8 -*-
import asyncio
import json
import sys
import time
from typing import Dict, Any, List
import httpx

import os
import pathlib

backend_dir = str(pathlib.Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# MediFlow AI Evaluation Suite - 100 Clinical Test Cases
BASE_URL = "http://127.0.0.1:8080/api/v1"

TEST_DATA: List[Dict[str, Any]] = []

# Generate 100 Categorized Cases across Tier 1, Tier 2, and Tier 3
# 1. Tier 3: Emergency Red-Flags (English, Nastaliq Urdu, Roman Urdu)
red_flags = [
    ("Severe chest pain radiating to left arm", "en", "Tier 3"),
    ("Seene me shadeed dard aur paseena araha hai", "ur_roman", "Tier 3"),
    ("سینے میں شدید درد اور سانس لینے میں دشواری", "ur", "Tier 3"),
    ("Patient has acute shortness of breath and blue lips", "en", "Tier 3"),
    ("Sudden numbness on right side of face and arm", "en", "Tier 3"),
    ("Anaphylactic shock after penicillin injection", "en", "Tier 3"),
    ("Bohat tez bukhar 105 aur behoshi ki halat", "ur_roman", "Tier 3"),
    ("Heavy blood vomiting and fainting", "en", "Tier 3"),
    ("Coughing up large amounts of blood", "en", "Tier 3"),
    ("Sudden loss of speech and slurred words", "en", "Tier 3"),
]
for i in range(30):
    text, lang, tier = red_flags[i % len(red_flags)]
    TEST_DATA.append({
        "case_id": f"CASE_T3_{i+1:03d}",
        "query": f"{text} (Variant {i+1})",
        "lang": lang,
        "expected_tier": tier,
        "category": "acute_emergency"
    })

# 2. Tier 2: Ambiguous / Low Confidence / Unclear Dosages
ambiguous = [
    ("Take tab Panadol ... frequency unreadable blur scan", "en", "Tier 2"),
    ("Doctor ne parchi pe likha hai lkn dose samajh nahi arahi", "ur_roman", "Tier 2"),
    ("Augmentin 625mg take daily ??? blurred notes", "en", "Tier 2"),
    ("خوراک واضح نہیں ہے دھندلا پن ہے", "ur", "Tier 2"),
    ("Tab Brufen ... mg missing in prescription", "en", "Tier 2"),
]
for i in range(30):
    text, lang, tier = ambiguous[i % len(ambiguous)]
    TEST_DATA.append({
        "case_id": f"CASE_T2_{i+1:03d}",
        "query": f"{text} (Batch {i+1})",
        "lang": lang,
        "expected_tier": tier,
        "category": "ambiguity_review"
    })

# 3. Tier 1: Routine Informational & Timeline Scheduling
routine = [
    ("Take Paracetamol 500mg 1 tablet after meals twice daily", "en", "Tier 1"),
    ("Discharge summary: Omeprazole 20mg morning before breakfast for 14 days", "en", "Tier 1"),
    ("Panadol goli subah sham khane k baad leni hai", "ur_roman", "Tier 1"),
    ("Discharge note: Metformin 500mg once daily at dinner", "en", "Tier 1"),
    ("روزانہ ناشتے سے پہلے ایک گولی کھائیں", "ur", "Tier 1"),
    ("Explain lipid panel report: Cholesterol is 185 mg/dL", "en", "Tier 1"),
    ("Blood test result: Hemoglobin 14.2 g/dL benign markers", "en", "Tier 1"),
    ("Amoxicillin 500mg 1 cap TDS for 5 days with water", "en", "Tier 1"),
]
for i in range(40):
    text, lang, tier = routine[i % len(routine)]
    TEST_DATA.append({
        "case_id": f"CASE_T1_{i+1:03d}",
        "query": f"{text} (Regimen {i+1})",
        "lang": lang,
        "expected_tier": tier,
        "category": "routine_schedule"
    })

async def run_benchmark():
    results = []
    print(f"[*] Starting MediFlow AI Benchmark on {len(TEST_DATA)} Cases...\n")
    
    # Detect if live server is up, otherwise use direct in-process ASGITransport
    try:
        probe = httpx.get(f"{BASE_URL}/health", timeout=1.0)
        use_live = (probe.status_code == 200)
    except Exception:
        use_live = False

    if use_live:
        print("Connected to live MediFlow AI server on port 8080.\n")
        client_cm = httpx.AsyncClient(timeout=30.0)
    else:
        print("Live server not detected on port 8080. Running in-process via FastAPI ASGITransport...\n")
        from app.main import app
        client_cm = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8080")

    async with client_cm as client:
        # Check AMD ROCm Telemetry first
        try:
            rocm_resp = await client.get(f"{BASE_URL}/health/amd-rocm")
            print(f"AMD Hardware Telemetry Status: {rocm_resp.status_code}")
        except Exception as e:
            print(f"ROCm Telemetry Endpoint Check: Offline or Mocked ({e})")

        passed = 0
        failed = 0

        for item in TEST_DATA:
            payload = {
                "message": item["query"],
                "language": item["lang"],
                "session_id": f"bench_{item['case_id']}"
            }
            start_t = time.perf_counter()
            try:
                resp = await client.post(f"{BASE_URL}/chat", json=payload)
                elapsed_ms = round((time.perf_counter() - start_t) * 1000, 2)
                
                if resp.status_code == 200:
                    data = resp.json()
                    raw_tier = str(data.get("triage_tier", ""))
                    if "3" in raw_tier or "acute" in raw_tier.lower():
                        detected_tier = "Tier 3"
                    elif "2" in raw_tier or "ambiguous" in raw_tier.lower():
                        detected_tier = "Tier 2"
                    else:
                        detected_tier = "Tier 1"
                    status = "PASS" if detected_tier == item["expected_tier"] else "FAIL"
                    if status == "PASS":
                        passed += 1
                    else:
                        failed += 1

                    results.append({
                        "case_id": item["case_id"],
                        "category": item["category"],
                        "input": item["query"],
                        "expected_tier": item["expected_tier"],
                        "detected_tier": detected_tier,
                        "status": status,
                        "latency_ms": elapsed_ms,
                        "response_snippet": str(data.get("reply", ""))[:120]
                    })
                else:
                    failed += 1
                    results.append({
                        "case_id": item["case_id"],
                        "status": "ERROR",
                        "http_code": resp.status_code,
                        "error": resp.text
                    })
            except Exception as exc:
                failed += 1
                results.append({
                    "case_id": item["case_id"],
                    "status": "EXCEPTION",
                    "error": str(exc)
                })

    # Save to JSON Result file
    output_path = pathlib.Path(__file__).resolve().parent / "benchmark_results_100.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "total_cases": len(TEST_DATA),
            "passed": passed,
            "failed": failed,
            "accuracy_percentage": round((passed / len(TEST_DATA)) * 100, 2),
            "details": results
        }, f, indent=2, ensure_ascii=False)

    print(f"\n==========================================")
    print(f"[SUCCESS] Benchmark Complete!")
    print(f"Total: {len(TEST_DATA)} | Passed: {passed} | Failed: {failed}")
    print(f"Output saved to: {output_path}")
    print(f"==========================================")
    return passed, failed


import pytest

@pytest.mark.asyncio
async def test_sample_evaluation_cases():
    """Runs a representative sample (top cases from each tier) in pytest runner."""
    from app.main import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://127.0.0.1:8080") as client:
        # Tier 3 Emergency
        t3_resp = await client.post("/api/v1/chat", json={"message": "Severe chest pain radiating to left arm", "language_preference": "en"})
        assert t3_resp.status_code == 200
        assert t3_resp.json()["is_emergency"] is True
        assert t3_resp.json()["triage_tier"] == "tier_3_acute_emergency"

        # Tier 2 Ambiguity
        t2_resp = await client.post("/api/v1/chat", json={"message": "Take tab Panadol ... frequency unreadable blur scan", "language_preference": "en"})
        assert t2_resp.status_code == 200
        assert t2_resp.json()["clarification_required"] is True
        assert t2_resp.json()["triage_tier"] == "tier_2_ambiguous"

        # Tier 1 Routine
        t1_resp = await client.post("/api/v1/chat", json={"message": "Take Paracetamol 500mg 1 tablet after meals twice daily", "language_preference": "en"})
        assert t1_resp.status_code == 200
        assert t1_resp.json()["triage_tier"] == "tier_1_routine"


if __name__ == "__main__":
    asyncio.run(run_benchmark())