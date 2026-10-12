# -*- coding: utf-8 -*-
"""MediFlow AI - Unit Tests for Vector Store & Clinical Terminology
Tests drug salt lookups and deterministic local vector projections.
"""

import pytest
from app.db.vector_store import (
    clinical_vector_store,
    generate_local_dense_projection,
)


@pytest.mark.asyncio
async def test_lookup_salt_by_brand_panadol():
    result = await clinical_vector_store.lookup_salt_by_brand(None, "Panadol")
    assert result is not None
    assert result["generic_salt"] == "Paracetamol"
    assert "Fever" in result["common_indications"]


@pytest.mark.asyncio
async def test_lookup_salt_by_brand_augmentin():
    result = await clinical_vector_store.lookup_salt_by_brand(None, "Augmentin")
    assert result is not None
    assert "Amoxicillin" in result["generic_salt"]


@pytest.mark.asyncio
async def test_lookup_salt_by_brand_urdu():
    result = await clinical_vector_store.lookup_salt_by_brand(None, "\u067e\u06cc\u0646\u0627\u0688\u0648\u0644")
    assert result is not None
    assert result["generic_salt"] == "Paracetamol"


def test_generate_local_dense_projection():
    vec = generate_local_dense_projection("Panadol Paracetamol", dim=384)
    assert len(vec) == 384
    assert isinstance(vec[0], float)
    # Norm should be approximately 1.0 (unit normalized)
    import math
    norm = math.sqrt(sum(x * x for x in vec))
    assert abs(norm - 1.0) < 1e-3
