"""
ChromaDB-backed patient vector store with metadata filtering + vector search.

Single data store for the entire Clinic RAG system:
  - collection.get(where={...}) → deterministic metadata-only retrieval
  - collection.query(query_texts=[...]) → vector similarity search
  - collection.query(query_texts=[...], where={...}) → hybrid filtered vector search
"""

import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"

import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

load_dotenv()

CHROMA_PERSIST_DIR = str(Path(__file__).parent.parent / "chroma_db")
COLLECTION_NAME = "patient_records"


class PatientVectorStore:
    """ChromaDB-backed patient store with metadata filtering + vector search."""

    def __init__(self, persist_dir: str = CHROMA_PERSIST_DIR):
        """Initialize ChromaDB client with persistent storage."""
        import chromadb

        self.persist_dir = persist_dir
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )
        self._genai_client = None
        self._init_genai()

    def _init_genai(self):
        """Initialize Gemini client for embedding generation."""
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                from google import genai
                self._genai_client = genai.Client(api_key=api_key)
            except Exception as e:
                print(f"GenAI Client init error in vector_store: {e}")

    def _get_embedding(self, text: str) -> Optional[List[float]]:
        """Compute embedding vector for text via Gemini text-embedding-004."""
        if not text.strip() or not self._genai_client:
            return None

        try:
            response = self._genai_client.models.embed_content(
                model="text-embedding-004",
                contents=text[:2000]  # stay within token limits
            )
            if response and hasattr(response, "embedding") and hasattr(response.embedding, "values"):
                return list(response.embedding.values)
        except Exception as e:
            print(f"  Embedding error: {e}")

        return None

    def _get_embeddings_batch(self, texts: List[str], batch_size: int = 50) -> List[Optional[List[float]]]:
        """Compute embeddings for a batch of texts with rate limiting."""
        import time

        all_embeddings: List[Optional[List[float]]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            for text in batch:
                emb = self._get_embedding(text)
                all_embeddings.append(emb)

            # Rate limiting: small pause between batches
            if i + batch_size < len(texts):
                time.sleep(0.5)

        return all_embeddings

    def _patient_to_document(self, patient: Dict[str, Any]) -> str:
        """Convert patient record to a document string for embedding."""
        parts = [
            f"Patient: {patient.get('name', 'Unknown')}",
            f"Age: {patient.get('age', 'Unknown')} years",
            f"Gender: {patient.get('gender', 'Unknown')}",
            f"Diagnosis: {', '.join(patient.get('tags', []))}",
            f"Clinical Impression: {patient.get('clinical_impression', '')}",
            f"History: {patient.get('history', '')[:350]}",
            f"VNG Results: {patient.get('vng_results', '')[:250]}",
            f"Treatment: {patient.get('treatment', '')[:250]}",
        ]
        return "\n".join(parts)


    def _patient_to_metadata(self, patient: Dict[str, Any]) -> Dict[str, Any]:
        """Convert patient record to ChromaDB metadata dict.

        ChromaDB metadata values must be str, int, float, or bool.
        Tags stored as comma-separated string, filtered with $contains.
        Age unknown = -1 (not None).
        """
        return {
            "patient_id": patient.get("patient_id", ""),
            "name": patient.get("name", "Unknown"),
            "folder_name": patient.get("folder_name", ""),
            "filename": patient.get("filename", ""),
            "age": patient.get("age") if patient.get("age") is not None else -1,
            "gender": patient.get("gender") or "Unknown",
            "tags": patient.get("tags", []),
            "clinical_impression": (patient.get("clinical_impression") or "")[:500],
            "date_of_exam": patient.get("date_of_exam") or "N/A",
            "history_preview": (patient.get("history") or "")[:300],
            "treatment_preview": (patient.get("treatment") or "")[:300],
            "vng_preview": (patient.get("vng_results") or "")[:300],
        }

    def index_patients(self, patients: List[Dict[str, Any]]) -> int:
        """
        Upsert all patients into ChromaDB collection.
        Stores structured metadata (age, gender, tags, name, etc.).
        Returns count of indexed patients. Idempotent.
        """
        if not patients:
            return 0

        # Fast-path: if collection already contains all records, return immediately
        current_count = self.collection.count()
        if current_count >= len(patients):
            return current_count

        # Check which patients are already indexed
        existing_ids = set()
        try:
            existing = self.collection.get(include=[])
            existing_ids = set(existing["ids"])
        except Exception:
            pass


        # Prepare documents and metadata with strictly unique IDs
        ids = []
        documents = []
        metadatas = []
        seen_batch_ids = set(existing_ids)

        for p in patients:
            pid = p.get("patient_id", "")
            if not pid:
                safe_f = re.sub(r"[^a-zA-Z0-9_]", "_", p.get("folder_name", "unknown"))
                safe_fn = re.sub(r"[^a-zA-Z0-9_]", "_", p.get("filename", "report"))
                pid = f"{safe_f}__{safe_fn}"

            # Ensure absolute uniqueness within ChromaDB
            unique_id = pid
            counter = 1
            while unique_id in seen_batch_ids:
                safe_fn = re.sub(r"[^a-zA-Z0-9_]", "_", p.get("filename", f"doc{counter}"))
                unique_id = f"{pid}__{safe_fn}_{counter}"
                counter += 1

            if unique_id in existing_ids:
                continue

            seen_batch_ids.add(unique_id)
            doc_text = self._patient_to_document(p)
            metadata = self._patient_to_metadata(p)
            metadata["patient_id"] = p.get("patient_id") or unique_id

            ids.append(unique_id)
            documents.append(doc_text)
            metadatas.append(metadata)

        if not ids:
            print(f"✓ [Vector Store] All {len(patients)} patients already indexed in ChromaDB.")
            return self.collection.count()

        print(f"[Vector Store] Indexing {len(ids)} new patients into ChromaDB...")

        # Upsert in batches into ChromaDB
        batch_size = 100
        print(f"  Upserting {len(ids)} patients in batches of {batch_size}...")
        for i in range(0, len(ids), batch_size):
            end = min(i + batch_size, len(ids))
            self.collection.upsert(
                ids=ids[i:end],
                documents=documents[i:end],
                metadatas=metadatas[i:end],
            )


        total = len(existing_ids) + len(ids)
        print(f"✓ [Vector Store] Indexed {len(ids)} new patients. Total in ChromaDB: {total}")
        return total


    def _build_where_clause(self, filters: Dict[str, Any]) -> Optional[Dict]:
        """Translate filter dict to ChromaDB where clause."""
        conditions = []

        if "tags_contain" in filters and filters["tags_contain"]:
            conditions.append({"tags": {"$contains": filters["tags_contain"]}})

        if "age_gt" in filters and filters["age_gt"] is not None:
            conditions.append({"age": {"$gt": filters["age_gt"]}})

        if "age_lt" in filters and filters["age_lt"] is not None:
            conditions.append({"age": {"$lt": filters["age_lt"]}})

        if "age_gte" in filters and filters["age_gte"] is not None:
            conditions.append({"age": {"$gte": filters["age_gte"]}})

        if "age_lte" in filters and filters["age_lte"] is not None:
            conditions.append({"age": {"$lte": filters["age_lte"]}})

        if "gender" in filters and filters["gender"] and filters["gender"] != "All":
            conditions.append({"gender": {"$eq": filters["gender"]}})

        if "name_contains" in filters and filters["name_contains"]:
            # ChromaDB doesn't support text search on metadata, so we use $contains
            conditions.append({"name": {"$contains": filters["name_contains"]}})

        if not conditions:
            return None
        elif len(conditions) == 1:
            return conditions[0]
        else:
            return {"$and": conditions}

    def _result_to_patient_dict(self, idx: int, result: Dict) -> Dict[str, Any]:
        """Convert a ChromaDB result entry into a patient dict."""
        metadata = result["metadatas"][idx] if result.get("metadatas") else {}
        patient = {
            "patient_id": result["ids"][idx],
            "name": metadata.get("name", "Unknown"),
            "folder_name": metadata.get("folder_name", ""),
            "filename": metadata.get("filename", ""),
            "age": metadata.get("age") if metadata.get("age", -1) != -1 else None,
            "gender": metadata.get("gender") if metadata.get("gender") != "Unknown" else None,
            "tags": metadata.get("tags") if isinstance(metadata.get("tags"), list) else (metadata.get("tags", "").split(",") if metadata.get("tags") else []),
            "clinical_impression": metadata.get("clinical_impression", ""),
            "date_of_exam": metadata.get("date_of_exam", "N/A"),
            "history": metadata.get("history_preview", ""),
            "treatment": metadata.get("treatment_preview", ""),
            "vng_results": metadata.get("vng_preview", ""),
            "full_text": result["documents"][idx] if result.get("documents") else "",
            "snippet": metadata.get("clinical_impression", ""),
        }

        # Add distance/score if available
        if result.get("distances") and idx < len(result["distances"]):
            # ChromaDB returns distances; convert to similarity score
            distance = result["distances"][idx]
            patient["score"] = round(1.0 - distance, 4) if isinstance(distance, (int, float)) else 0.0

        return patient

    def get_by_filters(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Deterministic metadata-only retrieval. No vector search.
        Returns ALL matching patients (no limit).
        """
        where_clause = self._build_where_clause(filters)

        try:
            if where_clause:
                result = self.collection.get(
                    where=where_clause,
                    include=["documents", "metadatas"]
                )
            else:
                result = self.collection.get(
                    include=["documents", "metadatas"]
                )
        except Exception as e:
            print(f"ChromaDB get_by_filters error: {e}")
            return []

        patients = []
        for i in range(len(result["ids"])):
            patients.append(self._result_to_patient_dict(i, result))

        # Sort by name for deterministic ordering
        patients.sort(key=lambda p: p.get("name", "").lower())
        return patients

    def search_semantic(
        self,
        query: str,
        n_results: int = 20,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Vector similarity search with optional metadata pre-filter.
        Returns top-n patients ranked by cosine similarity.
        """
        count = self.collection.count()
        if count == 0:
            return []

        try:
            kwargs = {
                "query_texts": [query],
                "n_results": min(n_results, count),
                "include": ["documents", "metadatas", "distances"],
            }
            if filters:
                where_clause = self._build_where_clause(filters)
                if where_clause:
                    kwargs["where"] = where_clause

            result = self.collection.query(**kwargs)
        except Exception as e:
            print(f"ChromaDB semantic search error: {e}")
            return []


        patients = []
        if result and result.get("ids") and result["ids"]:
            # ChromaDB query returns nested lists: ids[0], metadatas[0], etc.
            ids_list = result["ids"][0] if result["ids"] else []
            flat_result = {
                "ids": ids_list,
                "documents": result["documents"][0] if result.get("documents") else [],
                "metadatas": result["metadatas"][0] if result.get("metadatas") else [],
                "distances": result["distances"][0] if result.get("distances") else [],
            }
            for i in range(len(ids_list)):
                patients.append(self._result_to_patient_dict(i, flat_result))

        return patients

    def get_all_patients(self) -> List[Dict[str, Any]]:
        """Return all patients with metadata (for BM25 indexing, stats, etc.)."""
        return self.get_by_filters({})

    def get_patient(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Return single patient by ID."""
        try:
            result = self.collection.get(
                ids=[patient_id],
                include=["documents", "metadatas"]
            )
            if result and result["ids"]:
                return self._result_to_patient_dict(0, result)
        except Exception as e:
            print(f"ChromaDB get_patient error: {e}")

        return None

    def get_count(self) -> int:
        """Return total number of indexed patients."""
        return self.collection.count()

    def delete_all(self):
        """Delete the entire collection and recreate it (for reindexing)."""
        import chromadb
        self.client.delete_collection(COLLECTION_NAME)
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )
        print("[Vector Store] Collection cleared for reindexing.")
