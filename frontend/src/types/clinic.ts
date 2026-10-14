export interface Patient {
  patient_id: string;
  folder_name: string;
  filename: string;
  file_path: string;
  name: string;
  age: number | null;
  gender: string | null;
  date_of_exam: string;
  tags: string[];
  history: string;
  past_history: string;
  ent_exam: string;
  neuro_exam: string;
  neurotological_exam: string;
  investigations: string;
  vng_results: string;
  clinical_impression: string;
  treatment: string;
  full_text: string;
  snippet?: string;
  score?: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface ClinicStats {
  total_patients: number;
  total_documents: number;
  chromadb_indexed?: number;
  gender_distribution: {
    Male: number;
    Female: number;
    Unknown: number;
  };
  age_distribution: Record<string, number>;
  tag_distribution: TagCount[];
}

export interface PatientListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  patients: Patient[];
}

export interface SourceCitation {
  patient_id: string;
  name: string;
  folder_name: string;
  filename: string;
  tags: string[];
  clinical_impression: string;
  snippet: string;
}

export interface RAGResponse {
  answer: string;
  sources: SourceCitation[];
  total_sources: number;
  query_type: 'structured' | 'semantic' | 'hybrid';
  total_matching: number;
  filters_applied: Record<string, unknown>;
}
