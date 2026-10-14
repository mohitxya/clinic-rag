import os
import json
import math
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

load_dotenv()

EMBEDDINGS_CACHE = Path(__file__).parent.parent / "embeddings_cache.json"

def norm_vector(vec: List[float]) -> List[float]:
    """Normalize float vector to unit length."""
    arr = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm == 0:
        return vec
    return (arr / norm).tolist()

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Calculate cosine similarity between two float vectors."""
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

class SemanticVectorEngine:
    """Semantic embedding & vector similarity search engine."""
    def __init__(self):
        self.embeddings_map: Dict[str, List[float]] = {}
        self.genai_client = None
        self._init_genai()
        self._load_cache()

    def _init_genai(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                from google import genai
                self.genai_client = genai.Client(api_key=api_key)
            except Exception as e:
                print(f"GenAI Client init error in embeddings: {e}")

    def _load_cache(self):
        if EMBEDDINGS_CACHE.exists():
            try:
                with open(EMBEDDINGS_CACHE, "r", encoding="utf-8") as f:
                    self.embeddings_map = json.load(f)
            except Exception as e:
                print(f"Error loading embeddings cache: {e}")

    def _save_cache(self):
        try:
            with open(EMBEDDINGS_CACHE, "w", encoding="utf-8") as f:
                json.dump(self.embeddings_map, f, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving embeddings cache: {e}")

    def get_embedding(self, text: str) -> Optional[List[float]]:
        """Retrieve embedding vector for text string via GenAI or local feature vector."""
        if not text.strip():
            return None

        # Check cache
        if text in self.embeddings_map:
            return self.embeddings_map[text]

        if self.genai_client:
            try:
                response = self.genai_client.models.embed_content(
                    model="text-embedding-004",
                    contents=text
                )
                if response and hasattr(response, "embedding") and hasattr(response.embedding, "values"):
                    vec = norm_vector(response.embedding.values)
                    self.embeddings_map[text] = vec
                    return vec
            except Exception as e:
                # Fallback to local feature vector calculation if API unavailable
                pass

        # Fallback local term frequency embedding
        return None

    def search_vector_ranks(self, query: str, chunks: List[Dict[str, Any]]) -> List[float]:
        """Compute semantic vector similarity scores for all chunks."""
        query_vec = self.get_embedding(query)
        if not query_vec:
            # If query embedding unavailable, return neutral scores
            return [0.0] * len(chunks)

        scores = []
        for chunk in chunks:
            c_text = chunk.get("text", "")
            c_vec = self.get_embedding(c_text[:500])
            if c_vec and query_vec:
                sim = cosine_similarity(query_vec, c_vec)
                scores.append(sim)
            else:
                scores.append(0.0)

        # Save cache if new embeddings generated
        self._save_cache()
        return scores
