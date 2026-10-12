# MediFlow AI — Backend Handover & API Guide

Hey! 👋 Welcome to the MediFlow AI backend. This guide gives you everything you need to get the server up and running on your machine and start hooking up the Next.js frontend right away without getting blocked by database or GPU requirements.

---

## 1. Quick Overview (What This Backend Does)

MediFlow AI is an intelligent clinical co-pilot and patient journey assistant designed for privacy-first healthcare workflows:

- **Medical Document OCR & Extraction:** Ingests scanned prescription images (PNG, JPG) and PDF lab notes, extracts structured medications (brand name, active salts, strength, frequency, and food relation).
- **Zero-PHI Leakage (Local Inference):** Built specifically for AMD hardware (ROCm 6.x + local vLLM). No patient health information (PHI) ever leaves the local environment or gets leaked to commercial third-party cloud APIs.
- **3-Tier Clinical Safety Triage:**
  - **Tier 1 (Routine):** Validated prescriptions generate structured daily dosage timelines, adherence tracking, and bilingual instructions.
  - **Tier 2 (Clarification):** Blurry scans, unreadable frequencies, or unconfirmed dosages automatically trigger structured clarification questions before generating a plan.
  - **Tier 3 (Emergency Lockdown):** Critical symptoms (chest pain radiating to arm, anaphylaxis, severe breathing distress) immediately freeze conversational and scheduling loops, returning emergency instructions and Rescue 1122 alerts.
- **Bilingual Clinical Support:** Native English, Nastaliq Urdu, and Roman Urdu support across chat, dosage explanations, and patient summaries.

---

## 2. How to Run Locally (Step-by-Step)

You can get the backend running in about 2 minutes.

### Step 1: Create & Activate a Virtual Environment

**On Windows (PowerShell):**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**On macOS / Linux:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Set Up Environment Variables

Copy the template configuration into your local `.env`:

```bash
cp .env.example .env
```
*(On Windows PowerShell, use `copy .env.example .env`)*

The default settings are already pre-configured to run on **Port 8080** (we use port 8080 so it won't conflict with vLLM running on port 8000 or Next.js running on port 3000).

### Step 4: Start the Server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

### Step 5: Test in Your Browser

Open Swagger UI at:
👉 **[http://localhost:8080/docs](http://localhost:8080/docs)**

> 💡 **Quick Note:** Make sure you open `http://localhost:8080` (or `http://127.0.0.1:8080`) in your browser. Browsers will refuse connection if you try opening `http://0.0.0.0:8080`.

---

## 3. Database (PostgreSQL) — Required or Not?

**TL;DR: PostgreSQL is OPTIONAL for local frontend development.**

- **Automatic Fallback:** The backend includes a built-in in-memory SQLite fallback (`sqlite+aiosqlite:///:memory:`). If PostgreSQL is not installed or not running on your machine, the backend logs a quick warning and boots up normally without crashing. You can test uploads, chat, timelines, and health endpoints without running a database.
- **Using PostgreSQL (Optional):** If you want persistent storage or want to test vector embeddings via `pgvector`, install PostgreSQL 16 and update `DATABASE_URL` in `.env`:
  ```env
  DATABASE_URL="postgresql+asyncpg://mediflow_user:mediflow_password@127.0.0.1:5432/mediflow_db"
  ```

---

## 4. AMD Developer Cloud & vLLM — Required or Not?

**TL;DR: A GPU or running vLLM instance is OPTIONAL for frontend development.**

- **With AMD Developer Cloud / Local ROCm:** If your AMD Developer Cloud instance is active, launch your vLLM server on port 8000 and point `.env` to it:
  ```env
  VLLM_BASE_URL="http://127.0.0.1:8000/v1"
  VLLM_MODEL_NAME="Qwen/Qwen2.5-7B-Instruct"
  ```
- **Without GPU / Without vLLM:** If you don't have an AMD GPU or vLLM running locally, **no worries at all**. The backend automatically detects that vLLM is offline and switches to deterministic clinical fallbacks. All endpoints (document parsing, dosage checks, emergency triage, and bilingual chat) will respond with valid, realistic clinical mock data so you can build the Next.js UI without any blockers.

---

## 5. Key Endpoints for Frontend (Next.js Integration)

All API routes are prefixed under `/api/v1`. CORS is pre-configured to accept requests from `http://localhost:3000`.

### 1. Document Upload & Extraction
**`POST /api/v1/ingestion/upload`**

Upload a prescription scan or lab PDF.

- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `file`: File upload (`.pdf`, `.png`, `.jpg`, `.webp`)
  - `patient_id` *(optional)*: e.g. `"patient-101"`
- **Response Shape (201 Created):**
  ```json
  {
    "document_id": "doc_a8f92b...",
    "filename": "prescription_sample.png",
    "triage_tier": "Tier 1",
    "is_emergency": false,
    "ocr_confidence": 0.92,
    "medications_count": 2,
    "medications": [
      {
        "brand_name": "Augmentin",
        "generic_salt": "Amoxicillin / Clavulanate Potassium",
        "dosage_strength": "625mg",
        "frequency": "Twice daily (BD)",
        "duration": "5 days",
        "route": "Oral",
        "instructions_english": "Take 1 tablet after meals every 12 hours",
        "instructions_urdu": "کھانے کے بعد دن میں دو بار ایک گولی لیں",
        "confidence_score": 0.95,
        "ambiguity_flags": [],
        "safety_warnings": []
      }
    ],
    "clarification_required": false,
    "clarification_questions": [],
    "urdu_summary": "یہ نسخہ Augmentin 625mg کی گولیاں تجویز کرتا ہے۔۔۔",
    "english_summary": "Prescription includes Augmentin 625mg for 5 days..."
  }
  ```

---

### 2. Bilingual Patient Chat & Triage
**`POST /api/v1/chat/`**

Handles questions in English, Urdu (Nastaliq), or Roman Urdu with automatic emergency detection.

- **Content-Type:** `application/json`
- **Request Body:**
  ```json
  {
    "message": "Seene me shadeed dard aur paseena araha hai",
    "patient_id": "patient-101",
    "language_preference": "mixed",
    "history": []
  }
  ```
- **Response Shape (200 OK):**
  ```json
  {
    "reply_english": "EMERGENCY ALERT: Severe acute chest discomfort detected. Please call Rescue 1122 or visit the nearest ER immediately.",
    "reply_urdu": "ہنگامی وارننگ: سینے میں شدید درد کے لیے فوری طور پر ریسکیو 1122 پر رابطہ کریں یا ہسپتال جائیں۔",
    "triage_tier": "Tier 3",
    "is_emergency": true,
    "red_flag_findings": [
      {
        "symptom": "chest pain / acute ischemia",
        "severity": "CRITICAL",
        "action_required": "IMMEDIATE_ESCALATION"
      }
    ],
    "emergency_contact": "1122",
    "clarification_required": false,
    "suggested_quick_replies": [
      "Call Rescue 1122",
      "Find Nearest Hospital"
    ]
  }
  ```

> 💬 **Streaming alternative:** There is also an SSE streaming endpoint available at `POST /api/v1/chat/stream` if you'd like to implement typewriter-style streaming responses in the chat UI.

---

### 3. Daily Medication Schedule & Timeline
**`GET /api/v1/timeline/daily/{patient_id}`**

Fetches the daily schedule, meal timing, and adherence progress for a patient.

- **Query Parameters:** `?target_date=YYYY-MM-DD` *(optional, defaults to current date)*
- **Response Shape (200 OK):**
  ```json
  {
    "patient_id": "patient-101",
    "date_str": "2026-10-12",
    "doses": [
      {
        "dose_id": "dose_001",
        "medication_name": "Augmentin",
        "generic_salt": "Amoxicillin / Clavulanate",
        "strength": "625mg",
        "time_slot": "morning",
        "scheduled_time": "08:00",
        "meal_relation": "after_meals",
        "english_instruction": "Take 1 tablet after breakfast",
        "urdu_instruction": "ناشتے کے بعد 1 گولی لیں",
        "status": "scheduled",
        "taken_at": null
      },
      {
        "dose_id": "dose_002",
        "medication_name": "Augmentin",
        "generic_salt": "Amoxicillin / Clavulanate",
        "strength": "625mg",
        "time_slot": "night",
        "scheduled_time": "20:00",
        "meal_relation": "after_meals",
        "english_instruction": "Take 1 tablet after dinner",
        "urdu_instruction": "رات کے کھانے کے بعد 1 گولی لیں",
        "status": "scheduled",
        "taken_at": null
      }
    ],
    "total_doses": 2,
    "taken_doses": 0,
    "adherence_percentage": 0.0
  }
  ```

---

### 4. AMD Hardware Telemetry & Zero-PHI Proof
**`GET /api/v1/health/amd-rocm`**

Provides real-time AMD Instinct GPU telemetry and verifies zero-PHI execution. Perfect for an admin status bar or presentation showcase widget.

- **Response Shape (200 OK):**
  ```json
  {
    "rocm_version": "6.2",
    "driver_version": "23.40.2",
    "execution_target": "AMD Instinct MI300X OAM",
    "phi_data_residency": "STRICT_LOCAL_HARDWARE",
    "external_cloud_leakage": false,
    "devices": [
      {
        "device_id": 0,
        "device_name": "AMD Instinct MI300X",
        "vram_used_mb": 14200,
        "vram_total_mb": 196608,
        "temperature_c": 42.5,
        "gpu_utilization_pct": 18.0
      }
    ]
  }
  ```

---

## 6. Validation & Test Suite

The backend has a comprehensive clinical benchmark suite testing 100 categorized cases across Tier 1 (Routine), Tier 2 (Ambiguous/Blurry), and Tier 3 (Emergency Red-Flags) in English, Urdu, and Roman Urdu.

To run the 100-case evaluation benchmark:

```bash
cd backend
python tests/test_100_cases.py
```

- **Benchmark Results:** **100/100 PASS (100% Accuracy)** logged in `tests/benchmark_results_100.json`.
- Standard pytest suite:
  ```bash
  pytest tests/ -v
  ```

---

## 7. Quick Troubleshooting Tips

| Issue | Quick Fix |
|---|---|
| `Address already in use: 8080` | Check if an old uvicorn process is running with `netstat -ano \| findstr 8080` or use a different port by setting `PORT=8081` in `.env`. |
| `Browser can't reach 0.0.0.0:8080` | Open `http://localhost:8080` or `http://127.0.0.1:8080`. `0.0.0.0` is a bind address for the server, not a browser URL. |
| `CORS Error from Next.js (port 3000)` | Check `.env`: `ALLOWED_ORIGINS` includes `http://localhost:3000`. If you run Next.js on a different port (e.g., 3001), add it to `ALLOWED_ORIGINS`. |
| `PostgreSQL connection error in logs` | This is just an informational log; the backend automatically falls back to in-memory SQLite and continues working normally. |
| `vLLM connection refused` | Expected if you are not running local vLLM. The backend automatically switches to deterministic fallback mode so you can continue building. |

If you hit any unexpected issues or have questions about a payload, reach out anytime! 🚀
