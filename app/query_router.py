"""
Query Intent Classifier & Router for Clinic RAG.

Classifies user natural language queries into three categories:
  - STRUCTURED: deterministic filter queries (SQL-like)
  - SEMANTIC: similarity search queries (vector-like)
  - HYBRID: filter + search combined

Extracts structured filters (tags, age ranges, gender) from natural language.
Pure rule-based — no LLM call, zero latency, fully deterministic.
"""

import re
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional


class QueryIntent(Enum):
    STRUCTURED = "structured"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"


@dataclass
class ParsedQuery:
    intent: QueryIntent
    original_prompt: str
    search_text: str  # the semantic part (empty for STRUCTURED)
    filters: Dict[str, Any] = field(default_factory=dict)
    # filter keys: "tags_contain", "age_gt", "age_lt", "age_gte", "age_lte",
    #              "gender", "name_contains"
    sort_by: Optional[str] = None
    sort_order: str = "asc"
    limit: Optional[int] = None


# Known diagnostic tag aliases → canonical tag names
TAG_ALIASES = {
    # BPPV
    "bppv": "BPPV",
    "benign paroxysmal positional vertigo": "BPPV",
    "positional vertigo": "BPPV",
    # Ménière's Disease
    "meniere": "Ménière's Disease",
    "menierre": "Ménière's Disease",
    "meniere's": "Ménière's Disease",
    "meniere's disease": "Ménière's Disease",
    "ménière": "Ménière's Disease",
    "ménière's": "Ménière's Disease",
    "ménière's disease": "Ménière's Disease",
    "md": "Ménière's Disease",
    # Vestibular Migraine
    "vestibular migraine": "Vestibular Migraine",
    "vm": "Vestibular Migraine",
    # PPPD
    "pppd": "PPPD",
    "persistent postural perceptual dizziness": "PPPD",
    "persistent postural": "PPPD",
    # Vestibular Hypofunction
    "vestibular hypofunction": "Vestibular Hypofunction",
    "vestibulopathy": "Vestibular Hypofunction",
    "vestibular hypo": "Vestibular Hypofunction",
    # Vestibular Neuritis
    "vestibular neuritis": "Vestibular Neuritis",
    "vn": "Vestibular Neuritis",
    # Labyrinthitis
    "labyrinthitis": "Labyrinthitis",
    # Semicircular Canal BPPV
    "semicircular canal": "Semicircular Canal BPPV",
    "pscc": "Semicircular Canal BPPV",
    "lscc": "Semicircular Canal BPPV",
    "ascc": "Semicircular Canal BPPV",
    "posterior canal": "Semicircular Canal BPPV",
    "lateral canal": "Semicircular Canal BPPV",
    "anterior canal": "Semicircular Canal BPPV",
    # Ataxia
    "ataxia": "Ataxia",
    # CVD
    "cerebrovascular": "Cerebrovascular / Stroke",
    "stroke": "Cerebrovascular / Stroke",
    "cvd": "Cerebrovascular / Stroke",
    # Hearing Loss
    "snhl": "Sensorineural Hearing Loss",
    "sensorineural hearing loss": "Sensorineural Hearing Loss",
    "hearing loss": "Sensorineural Hearing Loss",
    # CSOM
    "csom": "CSOM",
    # Motion Intolerance
    "motion intolerance": "Motion Intolerance",
    "motion sickness": "Motion Intolerance",
    # MDDS
    "mdds": "Mal de Debarquement",
    "mal de debarquement": "Mal de Debarquement",
}

# Patterns that signal STRUCTURED intent (aggregation / listing queries)
STRUCTURED_SIGNALS = [
    r"\b(?:all|every|each|list|show|display)\s+(?:patients?|records?|cases?)\b",
    r"\bhow many\b",
    r"\bcount\b",
    r"\btotal\b.*\bpatients?\b",
    r"\blist\b.*\bpatients?\b",
    r"\bwho (?:are|is|has|have|had)\b",
    r"\bwhich patients?\b",
    r"\bpatients? (?:with|who|diagnosed|having|aged|above|below|over|under|older|younger)\b",
    r"\bgive me (?:all|every|a list)\b",
    r"\bfind (?:all|every)\b",
    r"\bnames? of\b.*\bpatients?\b",
]

# Patterns that signal SEMANTIC intent (similarity / exploratory queries)
SEMANTIC_SIGNALS = [
    r"\bsimilar to\b",
    r"\blike\b.*\bcase\b",
    r"\bcompare\b",
    r"\bwhat (?:are|were|is)\b.*\b(?:symptoms?|findings?|treatments?|results?)\b",
    r"\bsummarize\b",
    r"\bexplain\b",
    r"\bdescribe\b",
    r"\bwhat treatments?\b",
    r"\bwhat (?:medications?|drugs?)\b",
    r"\bvng findings?\b",
    r"\bclinical (?:impression|presentation|features?)\b",
]


class QueryRouter:
    """Classifies user queries and extracts structured filters."""

    def parse(self, prompt: str) -> ParsedQuery:
        """
        Classify query intent and extract structured filters.

        Returns a ParsedQuery with:
          - intent: STRUCTURED, SEMANTIC, or HYBRID
          - search_text: the semantic portion of the query
          - filters: extracted structured filters
        """
        lower_prompt = prompt.lower().strip()

        # Step 1: Extract structured filters from the prompt
        filters = self._extract_filters(lower_prompt)

        # Step 2: Determine intent
        has_structured_signal = any(
            re.search(pat, lower_prompt) for pat in STRUCTURED_SIGNALS
        )
        has_semantic_signal = any(
            re.search(pat, lower_prompt) for pat in SEMANTIC_SIGNALS
        )
        has_filters = bool(filters)

        if has_structured_signal and not has_semantic_signal:
            intent = QueryIntent.STRUCTURED
        elif has_semantic_signal and not has_filters:
            intent = QueryIntent.SEMANTIC
        elif has_structured_signal and has_semantic_signal:
            intent = QueryIntent.HYBRID
        elif has_filters and has_semantic_signal:
            intent = QueryIntent.HYBRID
        elif has_filters and not has_semantic_signal:
            # Has filters but no explicit structured signal — still structured
            intent = QueryIntent.STRUCTURED
        else:
            # Default: treat as semantic search
            intent = QueryIntent.SEMANTIC

        # Superlative / extrema detection (youngest, oldest)
        sort_by = None
        sort_order = "asc"
        limit = None
        if re.search(r"\byoungest\b", lower_prompt):
            sort_by = "age"
            sort_order = "asc"
            limit = 1
            intent = QueryIntent.STRUCTURED
        elif re.search(r"\boldest\b", lower_prompt):
            sort_by = "age"
            sort_order = "desc"
            limit = 1
            intent = QueryIntent.STRUCTURED

        # Step 3: Build search text (remove filter fragments for semantic part)
        search_text = self._build_search_text(lower_prompt, filters)

        return ParsedQuery(
            intent=intent,
            original_prompt=prompt,
            search_text=search_text,
            filters=filters,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
        )

    def _extract_filters(self, prompt: str) -> Dict[str, Any]:
        """Extract structured filters from natural language prompt."""
        filters: Dict[str, Any] = {}

        # Tag extraction: match known diagnosis names
        for alias, canonical_tag in TAG_ALIASES.items():
            # Use word boundary matching for short aliases, substring for long ones
            if len(alias) <= 4:
                pattern = r"\b" + re.escape(alias) + r"\b"
            else:
                pattern = re.escape(alias)

            if re.search(pattern, prompt, re.IGNORECASE):
                filters["tags_contain"] = canonical_tag
                break  # Take the first match (most specific)

        # Age extraction: "above/over/older than 50", "above age 50", "below/under/younger than 30"
        age_gt_patterns = [
            r"(?:above|over|older than|greater than|>\s*)\s*(?:age\s*)?(\d{1,3})",
            r"(?:age\s*(?:above|over|greater than|>))\s*(\d{1,3})",
            r"(\d{1,3})\s*(?:and above|and older|\+\s*years?)",
        ]
        for pattern in age_gt_patterns:
            m = re.search(pattern, prompt)
            if m:
                age_val = int(m.group(1))
                if 1 <= age_val <= 120:
                    filters["age_gt"] = age_val
                break

        age_lt_patterns = [
            r"(?:below|under|younger than|less than|<\s*)\s*(?:age\s*)?(\d{1,3})",
            r"(?:age\s*(?:below|under|less than|<))\s*(\d{1,3})",
            r"(\d{1,3})\s*(?:and below|and younger)",
        ]
        for pattern in age_lt_patterns:
            m = re.search(pattern, prompt)
            if m:
                age_val = int(m.group(1))
                if 1 <= age_val <= 120:
                    filters["age_lt"] = age_val
                break


        # Age range: "between 30 and 60", "aged 30-60"
        age_range_patterns = [
            r"between\s+(\d{1,3})\s+and\s+(\d{1,3})",
            r"aged?\s+(\d{1,3})\s*[-–to]+\s*(\d{1,3})",
        ]
        for pattern in age_range_patterns:
            m = re.search(pattern, prompt)
            if m:
                low, high = int(m.group(1)), int(m.group(2))
                if 1 <= low <= 120 and 1 <= high <= 120:
                    filters["age_gte"] = min(low, high)
                    filters["age_lte"] = max(low, high)
                break

        # Gender extraction
        if re.search(r"\bmale\b(?!\s*patients?\s*(?:and|or)\s*female)", prompt):
            if not re.search(r"\bfemale\b", prompt):
                filters["gender"] = "Male"
        if re.search(r"\bfemale\b(?!\s*patients?\s*(?:and|or)\s*male)", prompt):
            if not re.search(r"\bmale\b", prompt):
                filters["gender"] = "Female"

        return filters

    def _build_search_text(self, prompt: str, filters: Dict[str, Any]) -> str:
        """Strip extracted filter terms from prompt to get the semantic search text."""
        search_text = prompt

        # Remove age filter phrases
        search_text = re.sub(
            r"(?:above|over|older than|below|under|younger than|greater than|less than)\s+\d{1,3}\s*(?:years?|yrs?)?",
            "", search_text
        )
        search_text = re.sub(r"between\s+\d{1,3}\s+and\s+\d{1,3}", "", search_text)
        search_text = re.sub(r"aged?\s+\d{1,3}\s*[-–to]+\s*\d{1,3}", "", search_text)

        # Remove gender filter phrases
        search_text = re.sub(r"\b(?:male|female)\s+patients?\b", "patients", search_text)

        # Remove structural preambles
        search_text = re.sub(
            r"^(?:list|show|display|give me|find)\s+(?:all|every)?\s*", "", search_text
        )

        # Clean up
        search_text = re.sub(r"\s+", " ", search_text).strip()

        return search_text
