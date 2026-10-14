import { ClinicStats, TagCount, PatientListResponse, Patient, RAGResponse } from '@/types/clinic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export async function fetchStats(): Promise<ClinicStats> {
  const res = await fetch(`${API_BASE}/api/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchTags(): Promise<TagCount[]> {
  const res = await fetch(`${API_BASE}/api/tags`);
  if (!res.ok) throw new Error('Failed to fetch tags');
  return res.json();
}

export async function fetchPatients(params: {
  q?: string;
  tag?: string;
  gender?: string;
  page?: number;
  page_size?: number;
}): Promise<PatientListResponse> {
  const query = new URLSearchParams({
    q: params.q || '',
    tag: params.tag || 'All',
    gender: params.gender || 'All',
    page: String(params.page || 1),
    page_size: String(params.page_size || 24),
  });
  const res = await fetch(`${API_BASE}/api/patients?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch patients');
  return res.json();
}

export async function fetchPatientDetail(patientId: string): Promise<Patient> {
  const res = await fetch(`${API_BASE}/api/patients/${encodeURIComponent(patientId)}`);
  if (!res.ok) throw new Error('Failed to fetch patient details');
  return res.json();
}

export async function queryRAG(prompt: string, tagFilter = 'All', topK = 20): Promise<RAGResponse> {
  const res = await fetch(`${API_BASE}/api/query-rag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      tag_filter: tagFilter,
      top_k: topK,
    }),
  });
  if (!res.ok) throw new Error('Failed to execute RAG query');
  return res.json();
}
