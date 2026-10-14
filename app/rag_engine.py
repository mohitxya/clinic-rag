"""
Hybrid RAG Engine for Clinic Dataset.

Uses a query router to classify queries and route them to the appropriate engine:
  - STRUCTURED queries → ChromaDB metadata filtering (deterministic, complete)
  - SEMANTIC queries → ChromaDB vector search + BM25 reranking (ranked)
  - HYBRID queries → ChromaDB filtered vector search (filtered + ranked)
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from rank_bm25 import BM25Okapi
from dotenv import load_dotenv

from app.parser import load_all_patients
from app.vector_store import PatientVectorStore
from app.query_router import QueryRouter, QueryIntent, ParsedQuery

load_dotenv()


def tokenize(text: str) -> List[str]:
    """Tokenize text into lower-case alphanumeric words for BM25 indexing."""
    return re.findall(r"\w+", text.lower())


class ClinicRAGEngine:
    def __init__(self):
        self.patients: List[Dict[str, Any]] = []
        self.patient_map: Dict[str, Dict[str, Any]] = {}
        self.bm25: Optional[BM25Okapi] = None
        self.corpus_tokens: List[List[str]] = []
        self.bm25_patient_ids: List[str] = []

        self.vector_store = PatientVectorStore()
        self.router = QueryRouter()
        self.gemini_client = None

        self._load_and_index()
        self._init_gemini()

    def _load_and_index(self):
        """Load patient records from parser cache and index into ChromaDB + BM25."""
        self.patients = load_all_patients()
        self.patient_map = {p["patient_id"]: p for p in self.patients}

        # Index into ChromaDB (idempotent — skips already indexed patients)
        if self.patients:
            self.vector_store.index_patients(self.patients)

        # Build BM25 index for secondary ranking in semantic queries
        self._build_bm25_index()

    def _build_bm25_index(self):
        """Build BM25 index from patient records for lexical scoring."""
        self.corpus_tokens = []
        self.bm25_patient_ids = []

        for p in self.patients:
            combined_text = (
                f"{p['name']} {' '.join(p['tags'])} "
                f"{p['clinical_impression']} {p['history']} "
                f"{p['vng_results']} {p['treatment']} {p['full_text']}"
            )
            tokens = tokenize(combined_text)
            self.corpus_tokens.append(tokens)
            self.bm25_patient_ids.append(p["patient_id"])

        if self.corpus_tokens:
            self.bm25 = BM25Okapi(self.corpus_tokens)

    def reload_dataset(self, force_reload: bool = False):
        """Reload patient records and rebuild all indices."""
        if force_reload:
            self.vector_store.delete_all()
        self.patients = load_all_patients(force_reload=force_reload)
        self.patient_map = {p["patient_id"]: p for p in self.patients}
        if self.patients:
            self.vector_store.index_patients(self.patients)
        self._build_bm25_index()

    def _init_gemini(self):
        """Initialize Google GenAI client if API key is present."""
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=api_key)
            except Exception as e:
                print(f"Error initializing Google GenAI client: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Generate statistical summary of dataset for dashboard."""
        total_patients = len(self.patients)
        tag_counts: Dict[str, int] = {}
        gender_counts: Dict[str, int] = {"Male": 0, "Female": 0, "Unknown": 0}
        age_groups: Dict[str, int] = {"0-18": 0, "19-35": 0, "36-50": 0, "51-65": 0, "66+": 0, "Unknown": 0}

        for p in self.patients:
            for t in p.get("tags", []):
                tag_counts[t] = tag_counts.get(t, 0) + 1

            g = p.get("gender")
            if g == "Male":
                gender_counts["Male"] += 1
            elif g == "Female":
                gender_counts["Female"] += 1
            else:
                gender_counts["Unknown"] += 1

            age = p.get("age")
            if age is None:
                age_groups["Unknown"] += 1
            elif age <= 18:
                age_groups["0-18"] += 1
            elif age <= 35:
                age_groups["19-35"] += 1
            elif age <= 50:
                age_groups["36-50"] += 1
            elif age <= 65:
                age_groups["51-65"] += 1
            else:
                age_groups["66+"] += 1

        sorted_tags = sorted(
            [{"tag": k, "count": v} for k, v in tag_counts.items()],
            key=lambda x: x["count"],
            reverse=True,
        )

        return {
            "total_patients": total_patients,
            "total_documents": total_patients,
            "chromadb_indexed": self.vector_store.get_count(),
            "gender_distribution": gender_counts,
            "age_distribution": age_groups,
            "tag_distribution": sorted_tags,
        }

    def search(
        self,
        query: str = "",
        tag_filter: Optional[str] = None,
        gender: Optional[str] = None,
        age_min: Optional[int] = None,
        age_max: Optional[int] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Search patients using ChromaDB filters + optional semantic vector search."""
        # Build filters for ChromaDB
        filters: Dict[str, Any] = {}
        if tag_filter and tag_filter != "All":
            filters["tags_contain"] = tag_filter
        if gender and gender != "All":
            filters["gender"] = gender
        if age_min is not None:
            filters["age_gte"] = age_min
        if age_max is not None:
            filters["age_lte"] = age_max

        clean_query = query.strip()

        if not clean_query:
            # No query text: deterministic filter-only retrieval
            results = self.vector_store.get_by_filters(filters)
            return results[:limit]

        # Has query text: use semantic search with filters
        results = self.vector_store.search_semantic(
            query=clean_query,
            n_results=limit,
            filters=filters if filters else None,
        )

        # BM25 reranking: compute BM25 scores and fuse with vector scores
        if self.bm25 and results:
            results = self._rrf_rerank(results, clean_query)

        return results[:limit]

    def _bm25_search(self, query: str, top_k: int = 40) -> List[Dict[str, Any]]:
        """Perform BM25 lexical search and return ranked patients."""
        if not self.bm25:
            return []

        query_tokens = tokenize(query)
        scores = self.bm25.get_scores(query_tokens)

        # Get top-k indices by BM25 score
        scored_indices = sorted(
            range(len(scores)), key=lambda i: scores[i], reverse=True
        )[:top_k]

        results = []
        for idx in scored_indices:
            pid = self.bm25_patient_ids[idx]
            patient = self.patient_map.get(pid)
            if patient:
                p_copy = dict(patient)
                p_copy["bm25_score"] = float(scores[idx])
                results.append(p_copy)

        return results

    def _rrf_rerank(
        self,
        vector_results: List[Dict[str, Any]],
        query: str,
        k: int = 60,
    ) -> List[Dict[str, Any]]:
        """Reciprocal Rank Fusion (RRF) of vector search + BM25 rankings."""
        # Build vector rank map
        vector_rank = {}
        for rank, p in enumerate(vector_results):
            vector_rank[p["patient_id"]] = rank + 1

        # Get BM25 scores for the same patients
        query_tokens = tokenize(query)
        bm25_scores = {}
        if self.bm25:
            all_scores = self.bm25.get_scores(query_tokens)
            for idx, pid in enumerate(self.bm25_patient_ids):
                bm25_scores[pid] = all_scores[idx]

        # Build BM25 rank for the vector result set
        result_pids = [p["patient_id"] for p in vector_results]
        bm25_sorted = sorted(result_pids, key=lambda pid: bm25_scores.get(pid, 0), reverse=True)
        bm25_rank = {pid: rank + 1 for rank, pid in enumerate(bm25_sorted)}

        # RRF fusion
        for p in vector_results:
            pid = p["patient_id"]
            r_vec = vector_rank.get(pid, 999)
            r_bm25 = bm25_rank.get(pid, 999)
            rrf_score = (1.0 / (k + r_vec)) + (1.0 / (k + r_bm25))
            p["score"] = round(rrf_score, 6)

        vector_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        return vector_results

    def _extract_snippet(self, text: str, query_tokens: List[str], max_len: int = 250) -> str:
        """Extract relevant text snippet highlighting query terms."""
        if not text:
            return ""
        lines = text.split("\n")
        best_line = lines[0] if lines else ""
        max_matches = 0

        for line in lines:
            matches = sum(1 for tok in query_tokens if tok in line.lower())
            if matches > max_matches:
                max_matches = matches
                best_line = line

        if len(best_line) > max_len:
            return best_line[:max_len] + "..."
        return best_line

    def query_rag(
        self, prompt: str, tag_filter: Optional[str] = None, top_k: int = 20
    ) -> Dict[str, Any]:
        """
        Perform Hybrid RAG synthesis using query routing.

        STRUCTURED queries → deterministic filter → ALL results → Gemini synthesis
        SEMANTIC queries → vector search + BM25 rerank → top-k → Gemini synthesis
        HYBRID queries → filtered vector search → top-k → Gemini synthesis
        """
        # Classify the query
        parsed = self.router.parse(prompt)

        # Apply UI tag filter if set (overrides extracted tag filter)
        if tag_filter and tag_filter != "All":
            parsed.filters["tags_contain"] = tag_filter

        # Route to the appropriate retrieval path
        if parsed.intent == QueryIntent.STRUCTURED:
            # Deterministic: get ALL matching patients
            context_patients = self.vector_store.get_by_filters(parsed.filters)

            # Enrich with full patient data from cache
            context_patients = self._enrich_patients(context_patients)

            # Apply sorting and limits if specified (e.g. youngest/oldest)
            if parsed.sort_by == "age":
                valid_age = [p for p in context_patients if p.get("age") is not None]
                unknown_age = [p for p in context_patients if p.get("age") is None]
                valid_age.sort(
                    key=lambda p: p["age"],
                    reverse=(parsed.sort_order == "desc")
                )
                context_patients = valid_age + unknown_age

            if parsed.limit is not None:
                context_patients = context_patients[:parsed.limit]

        elif parsed.intent == QueryIntent.SEMANTIC:
            # Semantic: vector search + BM25 rerank
            vector_results = self.vector_store.search_semantic(
                parsed.search_text or parsed.original_prompt,
                n_results=top_k * 2,
            )
            bm25_results = self._bm25_search(
                parsed.search_text or parsed.original_prompt,
                top_k=top_k * 2,
            )

            # RRF fuse if we have both
            if vector_results and bm25_results:
                context_patients = self._rrf_rerank(vector_results, parsed.search_text or parsed.original_prompt)[:top_k]
            elif vector_results:
                context_patients = vector_results[:top_k]
            else:
                context_patients = bm25_results[:top_k]

            context_patients = self._enrich_patients(context_patients)

        else:  # HYBRID
            # Filtered vector search
            context_patients = self.vector_store.search_semantic(
                parsed.search_text or parsed.original_prompt,
                n_results=top_k,
                filters=parsed.filters,
            )
            context_patients = self._enrich_patients(context_patients)

        # Fallback: if no results with filters, try without tag filter
        if not context_patients and tag_filter and tag_filter != "All":
            parsed.filters.pop("tags_contain", None)
            context_patients = self.vector_store.search_semantic(
                parsed.original_prompt, n_results=top_k
            )
            context_patients = self._enrich_patients(context_patients)

        # Build context and synthesize with Gemini
        context_blocks = []
        sources = []

        for p in context_patients:
            block = (
                f"### PATIENT RECORD: {p.get('name', 'Unknown')}\n"
                f"- **Folder / ID**: {p.get('folder_name', '')}\n"
                f"- **Age / Gender**: {p.get('age', 'N/A')} yrs / {p.get('gender', 'N/A')}\n"
                f"- **Tags**: {', '.join(p.get('tags', []))}\n"
                f"- **Clinical Impression**: {p.get('clinical_impression', '')}\n"
                f"- **History & Symptoms**: {p.get('history', '')[:450]}\n"
                f"- **VNG & Test Findings**: {p.get('vng_results', '')[:350]}\n"
                f"- **Prescribed Treatment**: {p.get('treatment', '')[:350]}\n"
            )
            context_blocks.append(block)
            sources.append({
                "patient_id": p.get("patient_id", ""),
                "name": p.get("name", "Unknown"),
                "folder_name": p.get("folder_name", ""),
                "filename": p.get("filename", ""),
                "tags": p.get("tags", []),
                "clinical_impression": p.get("clinical_impression", ""),
                "snippet": p.get("clinical_impression", "") or p.get("snippet", ""),
            })

        combined_context = "\n\n".join(context_blocks)

        # Build system instruction based on query type
        query_type_note = ""
        if parsed.intent == QueryIntent.STRUCTURED:
            query_type_note = (
                f"\n\nQUERY TYPE: STRUCTURED (deterministic filter query).\n"
                f"Total matching patients: {len(context_patients)}.\n"
                f"Filters applied: {parsed.filters}.\n"
                f"IMPORTANT: Include ALL {len(context_patients)} patients in your response. "
                f"Do NOT skip or truncate. Use a table format for large result sets."
            )
        elif parsed.intent == QueryIntent.HYBRID:
            query_type_note = (
                f"\n\nQUERY TYPE: HYBRID (filtered + semantic search).\n"
                f"Filters applied: {parsed.filters}.\n"
                f"Results ranked by relevance within the filtered set."
            )

        system_instruction = (
            "You are Clinic AI, an expert neurotology & ENT clinical assistant for Dr. Amol Acharya's Vertigo Clinic.\n"
            "Your objective is to provide a COMPLETE, THOROUGH, visually organized clinical synthesis answering the user query.\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. DO NOT TRUNCATE your response. Complete all sections fully.\n"
            "2. Use clean, rich Markdown formatting:\n"
            "   - Header 2 (`##`) for main sections.\n"
            "   - Bullet points (`- `) for lists.\n"
            "   - **Bold text** for medical terms, medications, diagnostic tests, and patient names.\n"
            "   - Markdown Tables (`| Header | ... |`) when comparing multiple patients, symptoms, or treatments.\n"
            "3. Explicitly cite patient names when mentioning specific case findings.\n"
            "4. Base your answer strictly on the provided patient context records."
            f"{query_type_note}"
        )

        user_prompt = (
            f"User Query: {prompt}\n\n"
            f"Retrieved Patient Context Records ({len(context_patients)} records):\n{combined_context}"
        )

        if not self.gemini_client:
            return {
                "answer": (
                    f"**Gemini API Key missing or not configured.**\n\n"
                    f"Retrieved **{len(context_patients)}** relevant patient records for your query. "
                    f"You can view the retrieved sources below."
                ),
                "sources": sources,
                "total_sources": len(sources),
                "query_type": parsed.intent.value,
                "total_matching": len(context_patients),
                "filters_applied": parsed.filters,
            }

        # Determine max tokens based on result set size
        max_tokens = 4096
        if len(context_patients) > 20:
            max_tokens = 8192
        if len(context_patients) > 50:
            max_tokens = 16384

        candidate_models = ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-flash-latest"]
        last_error = ""

        for model_name in candidate_models:
            try:
                from google.genai import types

                response = self.gemini_client.models.generate_content(
                    model=model_name,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.2,
                        max_output_tokens=max_tokens,
                    ),
                )

                answer_text = (
                    response.text
                    if response and hasattr(response, "text")
                    else "No response generated."
                )

                return {
                    "answer": answer_text,
                    "sources": sources,
                    "total_sources": len(sources),
                    "query_type": parsed.intent.value,
                    "total_matching": len(context_patients),
                    "filters_applied": parsed.filters,
                }
            except Exception as e:
                last_error = str(e)
                continue

        return {
            "answer": (
                f"An error occurred while generating response with Gemini AI: {last_error}. "
                f"Below are the retrieved patient records matching your query."
            ),
            "sources": sources,
            "total_sources": len(sources),
            "query_type": parsed.intent.value,
            "total_matching": len(context_patients),
            "filters_applied": parsed.filters,
        }

    def _enrich_patients(self, patients: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enrich patient dicts from ChromaDB with full data from parser cache."""
        enriched = []
        for p in patients:
            pid = p.get("patient_id", "")
            full_patient = self.patient_map.get(pid)
            if full_patient:
                # Merge: use full patient data but keep any score from search
                merged = dict(full_patient)
                if "score" in p:
                    merged["score"] = p["score"]
                enriched.append(merged)
            else:
                enriched.append(p)
        return enriched
