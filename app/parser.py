import os
import re
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from concurrent.futures import ThreadPoolExecutor
import docx

DATASET_DIR = Path(__file__).parent.parent / "dataset"
CACHE_FILE = Path(__file__).parent.parent / "dataset_cache.json"

TAG_PATTERNS = [
    ("BPPV", r"\bbppv\b|benign paroxysmal positional vertigo"),
    ("Ménière's Disease", r"\bmd\b|menierre|meniere"),
    ("Vestibular Migraine", r"\bvm\b|vestibular migraine"),
    ("PPPD", r"\bpppd\b|persistent postural"),
    ("Vestibular Hypofunction", r"vest.*hypo|vestibulopathy|unilateral.*vest|bilateral.*vest"),
    ("Vestibular Neuritis", r"\bvn\b|vestibular neuritis"),
    ("Labyrinthitis", r"labyrinthitis"),
    ("Semicircular Canal BPPV", r"lscc|pscc|ascc|posterior canal|lateral canal|anterior canal"),
    ("Ataxia", r"ataxia"),
    ("Cerebrovascular / Stroke", r"\bcvd\b|cva|stroke|infarct|lesion"),
    ("Sensorineural Hearing Loss", r"\bsnhl\b|hearing loss"),
    ("CSOM", r"\bcsom\b"),
    ("Motion Intolerance", r"motion (intolerance|sens|sickness)"),
    ("Mal de Debarquement", r"mdds|mal de debarq"),
]

def extract_tags(text: str, folder_name: str) -> List[str]:
    """Extract clinical diagnostic tags from folder name and clinical text."""
    combined = (folder_name + " " + text).lower()
    tags = set()
    for tag_name, pattern in TAG_PATTERNS:
        if re.search(pattern, combined):
            tags.add(tag_name)
    if not tags:
        tags.add("General Vertigo")
    return sorted(list(tags))

def parse_patient_docx(file_path: Path, folder_name: str) -> Dict[str, Any]:
    """Parse a single patient .docx report file into structured fields and granular chunks."""
    doc = docx.Document(file_path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    full_text = "\n".join(paragraphs)

    name = folder_name
    age = None
    gender = None
    date_of_exam = None

    for line in paragraphs[:20]:
        name_match = re.search(r"(?:Name|Patient Name)\s*[:–-]\s*([^,\t\n\/]+)", line, re.IGNORECASE)
        if name_match and len(name_match.group(1).strip()) > 2:
            extracted_name = name_match.group(1).strip()
            if "Amol Acharya" not in extracted_name and "Dr." not in extracted_name:
                name = extracted_name

        age_sex_match = re.search(r"(\d{1,3})\s*(?:yrs|years)?\s*[\/\,-]\s*(male|female|m|f)", line, re.IGNORECASE)
        if age_sex_match:
            age = int(age_sex_match.group(1))
            g_str = age_sex_match.group(2).lower()
            gender = "Male" if g_str in ("male", "m") else "Female"

        date_match = re.search(r"(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})", line)
        if date_match and not date_of_exam:
            date_of_exam = date_match.group(1)

    if name == folder_name:
        clean_name = re.sub(r"\s+(Lt\.|Rt\.|BPPV|MD|VM|PPPD|SYMP|MED|Lt|Rt).*", "", folder_name, flags=re.IGNORECASE)
        name = clean_name.strip() or folder_name

    sections = {
        "history": [],
        "past_history": [],
        "ent_exam": [],
        "neuro_exam": [],
        "neurotological_exam": [],
        "investigations": [],
        "vng_results": [],
        "clinical_impression": [],
        "treatment": [],
        "review": []
    }

    current_section = "history"
    for line in paragraphs:
        lower_line = line.lower()
        if "history" in lower_line and "past" not in lower_line:
            current_section = "history"
        elif "past history" in lower_line:
            current_section = "past_history"
        elif "ent examination" in lower_line:
            current_section = "ent_exam"
        elif "neurological" in lower_line and "neurotological" not in lower_line:
            current_section = "neuro_exam"
        elif "neurotological" in lower_line:
            current_section = "neurotological_exam"
        elif "previous investigations" in lower_line or "investigations" in lower_line:
            current_section = "investigations"
        elif "video nystagmography" in lower_line or "vng" in lower_line:
            current_section = "vng_results"
        elif "impression" in lower_line:
            current_section = "clinical_impression"
        elif "treatment" in lower_line:
            current_section = "treatment"
        elif "review" in lower_line:
            current_section = "review"

        sections[current_section].append(line)

    history_text = "\n".join(sections["history"])
    past_history_text = "\n".join(sections["past_history"])
    ent_exam_text = "\n".join(sections["ent_exam"])
    neuro_exam_text = "\n".join(sections["neuro_exam"])
    neurotological_text = "\n".join(sections["neurotological_exam"])
    investigations_text = "\n".join(sections["investigations"])
    vng_text = "\n".join(sections["vng_results"])
    clinical_impression_text = "\n".join(sections["clinical_impression"])
    treatment_text = "\n".join(sections["treatment"])

    tags = extract_tags(full_text, folder_name)
    patient_id = re.sub(r"[^\w\-]", "_", folder_name)

    # Generate granular semantic chunks for Vector Embeddings & RAG
    chunks = [
        {
            "chunk_id": f"{patient_id}_demographics",
            "section": "demographics",
            "text": f"Patient: {name}. Age: {age or 'N/A'}. Gender: {gender or 'N/A'}. Date: {date_of_exam or 'N/A'}. Tags: {', '.join(tags)}."
        },
        {
            "chunk_id": f"{patient_id}_history",
            "section": "symptoms_history",
            "text": f"Patient {name} Clinical History & Symptoms: {history_text}\nPast Medical History: {past_history_text}"
        },
        {
            "chunk_id": f"{patient_id}_exam",
            "section": "examination",
            "text": f"Patient {name} Physical & Neurotological Examination: {ent_exam_text}\n{neuro_exam_text}\n{neurotological_text}"
        },
        {
            "chunk_id": f"{patient_id}_vng",
            "section": "vng_tests",
            "text": f"Patient {name} VNG & Investigations: {investigations_text}\nVideo Nystagmography Results: {vng_text}"
        },
        {
            "chunk_id": f"{patient_id}_diagnosis_treatment",
            "section": "impression_treatment",
            "text": f"Patient {name} Clinical Impression / Diagnosis: {clinical_impression_text}\nPrescribed Treatment Plan: {treatment_text}"
        }
    ]

    return {
        "patient_id": patient_id,
        "folder_name": folder_name,
        "filename": file_path.name,
        "file_path": str(file_path),
        "name": name,
        "age": age,
        "gender": gender,
        "date_of_exam": date_of_exam or "N/A",
        "tags": tags,
        "history": history_text,
        "past_history": past_history_text,
        "ent_exam": ent_exam_text,
        "neuro_exam": neuro_exam_text,
        "neurotological_exam": neurotological_text,
        "investigations": investigations_text,
        "vng_results": vng_text,
        "clinical_impression": clinical_impression_text or "See full report text",
        "treatment": treatment_text,
        "full_text": full_text,
        "chunks": chunks
    }

def load_all_patients(dataset_path: Path = DATASET_DIR, force_reload: bool = False) -> List[Dict[str, Any]]:
    """Scan dataset directory and parse all patient reports (with JSON caching and parallel docx processing)."""
    if not force_reload and CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                patients = json.load(f)
                return patients
        except Exception as e:
            print(f"Cache load error: {e}, re-parsing dataset...")

    patients = []
    if not dataset_path.exists():
        return patients

    task_args = []
    for folder_name in os.listdir(dataset_path):
        folder_dir = dataset_path / folder_name
        if folder_dir.is_dir():
            for fname in os.listdir(folder_dir):
                if fname.endswith(".docx") and not fname.startswith("~$"):
                    file_path = folder_dir / fname
                    task_args.append((file_path, folder_name))

    def _parse_single(args):
        file_path, folder_name = args
        try:
            return parse_patient_docx(file_path, folder_name)
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            return None

    with ThreadPoolExecutor(max_workers=16) as executor:
        results = executor.map(_parse_single, task_args)
        for r in results:
            if r:
                patients.append(r)

    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(patients, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving patient cache: {e}")

    return patients
