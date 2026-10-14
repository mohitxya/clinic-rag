import os
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from app.rag_engine import ClinicRAGEngine

app = FastAPI(
    title="Clinic RAG & Patient Organization API",
    description="Hybrid RAG Engine and Management API for ENT & Vertigo Clinic Dataset",
    version="3.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global RAG Engine instance
rag_engine = ClinicRAGEngine()

# Static files directory
STATIC_DIR = Path(__file__).parent.parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

class SearchRequest(BaseModel):
    query: str = ""
    tag_filter: Optional[str] = "All"
    gender: Optional[str] = "All"
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    limit: int = 50

class RAGQueryRequest(BaseModel):
    prompt: str
    tag_filter: Optional[str] = "All"
    top_k: int = 20

@app.get("/")
def read_root():
    """Serve main SPA user interface."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Clinic RAG API v3 is running."}

@app.get("/api/stats")
def get_clinic_stats():
    """Retrieve statistical overview of the clinic dataset."""
    return rag_engine.get_stats()

@app.get("/api/tags")
def get_tags():
    """Retrieve list of diagnostic tags and patient counts."""
    stats = rag_engine.get_stats()
    return stats["tag_distribution"]

@app.get("/api/patients")
def list_patients(
    q: str = "",
    tag: str = "All",
    gender: str = "All",
    age_min: Optional[int] = None,
    age_max: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """Retrieve paginated patient list with hybrid search filtering."""
    results = rag_engine.search(
        query=q,
        tag_filter=tag,
        gender=gender,
        age_min=age_min,
        age_max=age_max,
        limit=500
    )

    total = len(results)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_data = results[start_idx:end_idx]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 1,
        "patients": paginated_data
    }

@app.get("/api/patients/{patient_id}")
def get_patient_detail(patient_id: str):
    """Retrieve full clinical details for a single patient."""
    # Try from parser cache first (has full text)
    patient = rag_engine.patient_map.get(patient_id)
    if patient:
        return patient

    # Fallback: case-insensitive search
    for p in rag_engine.patients:
        if p["patient_id"].lower() == patient_id.lower() or p["folder_name"].lower() == patient_id.lower():
            return p

    # Fallback: try ChromaDB
    chroma_patient = rag_engine.vector_store.get_patient(patient_id)
    if chroma_patient:
        return chroma_patient

    raise HTTPException(status_code=404, detail="Patient not found")

@app.post("/api/search")
def search_documents(req: SearchRequest):
    """Hybrid search endpoint."""
    results = rag_engine.search(
        query=req.query,
        tag_filter=req.tag_filter,
        gender=req.gender,
        age_min=req.age_min,
        age_max=req.age_max,
        limit=req.limit
    )
    return {"total": len(results), "results": results}

@app.post("/api/query-rag")
def query_rag_assistant(req: RAGQueryRequest):
    """Gemini AI powered hybrid RAG search & synthesis endpoint."""
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt query cannot be empty")
    return rag_engine.query_rag(
        prompt=req.prompt,
        tag_filter=req.tag_filter,
        top_k=req.top_k
    )

@app.post("/api/reindex")
def reindex_dataset():
    """Trigger full re-indexing of the dataset into ChromaDB."""
    try:
        rag_engine.reload_dataset(force_reload=True)
        return {
            "status": "success",
            "total_patients": len(rag_engine.patients),
            "chromadb_indexed": rag_engine.vector_store.get_count(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reindex failed: {str(e)}")
