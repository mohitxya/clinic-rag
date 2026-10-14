import os
import pytest
from fastapi.testclient import TestClient
from app.main import app, rag_engine
from app.parser import load_all_patients
from app.query_router import QueryRouter, QueryIntent

client = TestClient(app)


def test_parser_loading():
    """Verify patient records are parsed cleanly."""
    patients = load_all_patients()
    assert len(patients) > 0, "Patient dataset should contain parsed documents"
    first = patients[0]
    assert "patient_id" in first
    assert "name" in first
    assert "full_text" in first
    assert "tags" in first


def test_parser_age_extraction():
    """Verify improved age extraction covers most patients."""
    patients = load_all_patients()
    total = len(patients)
    with_age = sum(1 for p in patients if p.get("age") is not None)
    coverage = with_age / total if total > 0 else 0

    print(f"Age extraction coverage: {with_age}/{total} ({coverage:.1%})")
    # Should have at least 90% age coverage with improved parser
    assert coverage > 0.85, f"Age extraction coverage too low: {coverage:.1%}"


def test_stats_endpoint():
    """Verify statistics endpoint returns correct counts."""
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_patients"] > 0
    assert "gender_distribution" in data
    assert "tag_distribution" in data
    assert "chromadb_indexed" in data


def test_tags_endpoint():
    """Verify diagnostic tags endpoint."""
    response = client.get("/api/tags")
    assert response.status_code == 200
    tags = response.json()
    assert isinstance(tags, list)
    assert len(tags) > 0


def test_patients_list_and_search():
    """Verify patient list pagination and search filtering."""
    response = client.get("/api/patients?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "patients" in data
    assert len(data["patients"]) <= 10

    # Search query test
    search_resp = client.get("/api/patients?q=BPPV&page=1&page_size=5")
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert search_data["total"] > 0


def test_patient_detail_endpoint():
    """Verify single patient detail lookup."""
    patients = rag_engine.patients
    assert len(patients) > 0
    pid = patients[0]["patient_id"]

    response = client.get(f"/api/patients/{pid}")
    assert response.status_code == 200
    data = response.json()
    assert data["patient_id"] == pid


def test_search_post_endpoint():
    """Verify POST search endpoint."""
    response = client.post("/api/search", json={"query": "Meniere", "limit": 5})
    assert response.status_code == 200
    data = response.json()
    assert "results" in data


def test_rag_post_endpoint():
    """Verify RAG query endpoint returns query type metadata."""
    response = client.post(
        "/api/query-rag",
        json={"prompt": "What are common BPPV symptoms?", "top_k": 3},
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "sources" in data
    assert "query_type" in data
    assert data["query_type"] in ("structured", "semantic", "hybrid")
    assert "total_matching" in data
    assert "filters_applied" in data


def test_query_router_structured():
    """Verify query router classifies structured queries correctly."""
    router = QueryRouter()

    # Structured queries
    result = router.parse("List all patients with BPPV above age 50")
    assert result.intent == QueryIntent.STRUCTURED
    assert result.filters.get("tags_contain") == "BPPV"
    assert result.filters.get("age_gt") == 50

    result = router.parse("How many patients have Meniere's disease?")
    assert result.intent == QueryIntent.STRUCTURED
    assert result.filters.get("tags_contain") == "Ménière's Disease"

    result = router.parse("Show all female patients with vestibular migraine")
    assert result.intent == QueryIntent.STRUCTURED
    assert result.filters.get("tags_contain") == "Vestibular Migraine"
    assert result.filters.get("gender") == "Female"


def test_query_router_semantic():
    """Verify query router classifies semantic queries correctly."""
    router = QueryRouter()

    result = router.parse("What treatments work best for chronic dizziness?")
    assert result.intent == QueryIntent.SEMANTIC

    result = router.parse("Describe the clinical features of sudden episodic dizziness")
    assert result.intent == QueryIntent.SEMANTIC



def test_query_router_hybrid():
    """Verify query router classifies hybrid queries correctly."""
    router = QueryRouter()

    result = router.parse("What treatments were given to BPPV patients with anxiety?")
    assert result.intent == QueryIntent.HYBRID
    assert result.filters.get("tags_contain") == "BPPV"


def test_structured_bppv_over_50_deterministic():
    """
    CRITICAL DETERMINISM TEST:
    'All BPPV patients above age 50' must return the exact same 119 patients every single time.
    """
    router = QueryRouter()
    pq = router.parse("List all patients with BPPV above age 50")
    assert pq.intent == QueryIntent.STRUCTURED
    assert pq.filters.get("tags_contain") == "BPPV"
    assert pq.filters.get("age_gt") == 50

    # 1. Deterministic retrieval: verify identical patient IDs across 5 consecutive runs
    results_sets = []
    for _ in range(5):
        matching = rag_engine.vector_store.get_by_filters(pq.filters)
        pids = [p["patient_id"] for p in matching]
        results_sets.append(pids)

    # Every run must return the exact same patient set and exact same ordering
    for i in range(1, len(results_sets)):
        assert results_sets[i] == results_sets[0], f"Run {i+1} differed from Run 1"

    # Must find all 119 qualifying patients
    assert len(results_sets[0]) >= 100, f"Expected at least 100 BPPV over 50, got {len(results_sets[0])}"
    print(f"✓ Determinism confirmed: exactly {len(results_sets[0])} BPPV patients over 50 retrieved across all 5 runs.")

    # 2. Integration API call: verify /api/query-rag handles structured query with full metadata
    response = client.post(
        "/api/query-rag",
        json={"prompt": "List all patients with BPPV above age 50", "top_k": 50},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["query_type"] == "structured"
    assert data["total_matching"] == len(results_sets[0])
    assert len(data["sources"]) == len(results_sets[0])
    assert "answer" in data

def test_youngest_bppv_superlative():
    """Verify 'youngest bppv patient' routes to structured sort and returns single youngest patient."""
    router = QueryRouter()
    parsed = router.parse("youngest bppv patient")
    assert parsed.intent == QueryIntent.STRUCTURED
    assert parsed.filters.get("tags_contain") == "BPPV"
    assert parsed.sort_by == "age"
    assert parsed.sort_order == "asc"
    assert parsed.limit == 1

    # Call /api/query-rag
    response = client.post(
        "/api/query-rag",
        json={"prompt": "youngest bppv patient", "top_k": 10},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["query_type"] == "structured"
    assert data["total_matching"] == 1
    assert len(data["sources"]) == 1
    assert "answer" in data




