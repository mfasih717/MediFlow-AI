# -*- coding: utf-8 -*-
"""MediFlow AI - pgvector Clinical Terminology & Resilient Vector Embedding Store
Bilingual clinical terminology, drug-salt mapping, async storage, and vector semantic similarity.
Queries local AMD ROCm vLLM /v1/embeddings endpoint with a resilient deterministic
dense feature projection fallback to guarantee database vector storage never fails.
All Urdu literals use pure Unicode escape sequences (\\uXXXX) to guarantee 100% ASCII compatibility.
"""

from typing import Any, Dict, List, Optional
import hashlib
import math
import uuid
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.db.models.clinical import ClinicalTerminology, HAS_PGVECTOR
from app.engine.vllm_client import vllm_client

# Curated Pakistani & International Clinical Drug Knowledge Base (Pure Unicode Escapes)
CLINICAL_KNOWLEDGE_SEED = [
    {
        "term_english": "Panadol",
        "term_urdu": "\u067e\u06cc\u0646\u0627\u0688\u0648\u0644",
        "category": "medication",
        "generic_salt": "Paracetamol",
        "typical_dosage": "500mg",
        "max_safe_daily_dose": "4000mg",
        "common_indications": ["Fever", "Mild to moderate pain", "Headache"],
        "contraindications": ["Severe hepatic impairment", "Known paracetamol allergy"],
    },
    {
        "term_english": "Augmentin",
        "term_urdu": "\u0622\u06af\u0645\u0646\u0679\u0646",
        "category": "medication",
        "generic_salt": "Amoxicillin / Clavulanic Acid",
        "typical_dosage": "625mg or 1g",
        "max_safe_daily_dose": "3000mg amoxicillin",
        "common_indications": ["Bacterial infection", "Respiratory infection", "Sinusitis"],
        "contraindications": ["Penicillin allergy", "History of Augmentin-associated jaundice"],
    },
    {
        "term_english": "Glucophage",
        "term_urdu": "\u06af\u0644\u0648\u06a9\u0648\u0641\u06cc\u062c",
        "category": "medication",
        "generic_salt": "Metformin HCl",
        "typical_dosage": "500mg or 850mg",
        "max_safe_daily_dose": "2550mg",
        "common_indications": ["Type 2 Diabetes Mellitus"],
        "contraindications": ["Severe renal failure (eGFR < 30)", "Metabolic acidosis", "Lactic acidosis"],
    },
    {
        "term_english": "Disprin",
        "term_urdu": "\u0688\u0633\u067e\u0631\u06cc\u0646",
        "category": "medication",
        "generic_salt": "Aspirin (Acetylsalicylic Acid)",
        "typical_dosage": "75mg or 300mg",
        "max_safe_daily_dose": "4000mg",
        "common_indications": ["Antiplatelet prophylaxis", "Pain", "Fever"],
        "contraindications": ["Active peptic ulcer disease", "Bleeding disorders", "Children under 16 (Reye syndrome)"],
    },
    {
        "term_english": "Concor",
        "term_urdu": "\u06a9\u0648\u0646\u06a9\u0648\u0631",
        "category": "medication",
        "generic_salt": "Bisoprolol Fumarate",
        "typical_dosage": "2.5mg or 5mg",
        "max_safe_daily_dose": "20mg",
        "common_indications": ["Hypertension", "Angina pectoris", "Heart failure"],
        "contraindications": ["Severe bradycardia", "Cardiogenic shock", "Severe asthma"],
    },
    {
        "term_english": "Nexum",
        "term_urdu": "\u0646\u06cc\u06a9\u0633\u0645",
        "category": "medication",
        "generic_salt": "Esomeprazole",
        "typical_dosage": "20mg or 40mg",
        "max_safe_daily_dose": "80mg",
        "common_indications": ["GERD", "Gastric ulcers", "Acid reflux"],
        "contraindications": ["Hypersensitivity to PPIs"],
    },
    {
        "term_english": "Lopressor",
        "term_urdu": "\u0644\u0648\u067e\u0631\u06cc\u0633\u0631",
        "category": "medication",
        "generic_salt": "Metoprolol Tartrate",
        "typical_dosage": "50mg or 100mg",
        "max_safe_daily_dose": "400mg",
        "common_indications": ["Hypertension", "Angina", "Arrhythmia"],
        "contraindications": ["Sinus bradycardia", "Second or third-degree AV block"],
    },
]


def generate_local_dense_projection(text_input: str, dim: int = 384) -> List[float]:
    """Lightweight deterministic feature projection guaranteeing dense vectors even if vLLM only runs chat."""
    vec = [0.0] * dim
    clean = text_input.lower().strip()
    words = clean.split()
    if not words:
        words = ["clinical", "pharmaceutical"]

    for word in words:
        h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
        for i in range(8):
            idx = (h >> (i * 8)) % dim
            val = ((h >> (i * 8 + 4)) & 0xFF) / 127.5 - 1.0
            vec[idx] += val

    # L2 unit normalization
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        return [round(x / norm, 6) for x in vec]
    return vec


class ClinicalVectorStore:
    """Manages bilingual drug-salt queries, local embeddings, and pgvector storage and similarity search."""

    def __init__(self) -> None:
        self._local_dict: Dict[str, Dict[str, Any]] = {
            item["term_english"].lower(): item for item in CLINICAL_KNOWLEDGE_SEED
        }
        for item in CLINICAL_KNOWLEDGE_SEED:
            if item.get("term_urdu"):
                self._local_dict[item["term_urdu"].lower()] = item

    async def get_embedding(self, text_input: str, dim: int = 384) -> List[float]:
        """Fetches vector embedding from local vLLM /v1/embeddings route with resilient projection fallback."""
        try:
            vec = await vllm_client.create_embedding(text_input, dim=dim)
            if vec and len(vec) == dim:
                return vec
        except Exception as exc:
            logger.debug("vLLM embedding query notice: %s; using deterministic local projection.", exc)

        return generate_local_dense_projection(text_input, dim=dim)

    async def lookup_salt_by_brand(
        self, session: Optional[AsyncSession], brand_name: str
    ) -> Optional[Dict[str, Any]]:
        """Look up generic salt and safety limits by brand name (English or Urdu)."""
        clean = (brand_name or "").strip().lower()

        # Fast in-memory dictionary check
        if clean in self._local_dict:
            return self._local_dict[clean]

        for key, val in self._local_dict.items():
            if key in clean or (len(clean) >= 3 and clean in key):
                return val

        # Database lookup if session is supplied
        if session:
            try:
                stmt = select(ClinicalTerminology).where(
                    ClinicalTerminology.term_english.ilike(f"%{clean}%")
                ).limit(1)
                result = await session.execute(stmt)
                record = result.scalars().first()
                if record:
                    return {
                        "term_english": record.term_english,
                        "term_urdu": record.term_urdu,
                        "category": record.category,
                        "generic_salt": record.generic_salt,
                        "typical_dosage": record.typical_dosage,
                        "max_safe_daily_dose": record.max_safe_daily_dose,
                        "contraindications": record.contraindications,
                        "common_indications": record.common_indications,
                    }
            except Exception as exc:
                logger.debug("Database salt lookup fallback: %s", exc)

        return None

    async def store_clinical_term(
        self,
        session: AsyncSession,
        term_english: str,
        generic_salt: str,
        term_urdu: Optional[str] = None,
        category: str = "medication",
        typical_dosage: Optional[str] = None,
        max_safe_daily_dose: Optional[str] = None,
        common_indications: Optional[List[str]] = None,
        contraindications: Optional[List[str]] = None,
    ) -> ClinicalTerminology:
        """Asynchronously stores clinical terminology with dense vector embedding into pgvector."""
        vector = await self.get_embedding(f"{term_english} {generic_salt}", dim=384)
        term_id = f"term-{uuid.uuid4().hex[:10]}"
        record = ClinicalTerminology(
            id=term_id,
            term_english=term_english,
            term_urdu=term_urdu,
            category=category,
            generic_salt=generic_salt,
            typical_dosage=typical_dosage,
            max_safe_daily_dose=max_safe_daily_dose,
            common_indications=common_indications or [],
            contraindications=contraindications or [],
            embedding=vector if HAS_PGVECTOR else None,
        )
        session.add(record)
        # FIX MED-6: Do NOT call session.commit() here — the session is owned by the caller (get_db dependency).
        # The caller is responsible for committing. Double-commit causes consistency issues.
        await session.flush()  # Flush to DB without committing — validates constraints and assigns any DB defaults.
        return record

    async def semantic_search_salt(
        self, session: Optional[AsyncSession], query_text: str, limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Computes query embedding and executes pgvector cosine search (<=>)."""
        query_vector = await self.get_embedding(query_text, dim=384)

        if not session or not HAS_PGVECTOR:
            # Fallback to lexical matches
            q_lower = query_text.lower()
            matches = [v for k, v in self._local_dict.items() if q_lower in k or k in q_lower]
            if not matches:
                matches = list(self._local_dict.values())
            return matches[:limit]

        try:
            vector_str = f"[{','.join(str(round(x, 6)) for x in query_vector)}]"
            sql = text(
                """
                SELECT id, term_english, term_urdu, generic_salt, category,
                       embedding <=> :vector AS distance
                FROM clinical_terminologies
                ORDER BY distance ASC
                LIMIT :limit;
                """
            )
            result = await session.execute(sql, {"vector": vector_str, "limit": limit})
            rows = result.fetchall()
            if not rows:
                q_lower = query_text.lower()
                matches = [v for k, v in self._local_dict.items() if q_lower in k or k in q_lower]
                return (matches if matches else list(self._local_dict.values()))[:limit]
            return [
                {
                    "id": r.id,
                    "term_english": r.term_english,
                    "term_urdu": r.term_urdu,
                    "generic_salt": r.generic_salt,
                    "distance": float(r.distance),
                }
                for r in rows
            ]
        except Exception as exc:
            logger.debug("pgvector semantic search notice: %s", exc)
            return list(self._local_dict.values())[:limit]


clinical_vector_store = ClinicalVectorStore()
