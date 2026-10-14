'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RAGResponse } from '@/types/clinic';
import { queryRAG } from '@/lib/api';
import { Bot, Sparkles, Send, ChevronDown, FileText, Loader2, Database, Brain, Zap, Filter } from 'lucide-react';

interface ClinicAiAssistantProps {
  onSelectPatient: (patientId: string) => void;
}

const QUERY_TYPE_CONFIG = {
  structured: {
    label: 'Structured Query',
    icon: Database,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    description: 'Deterministic filter — all matching patients returned',
  },
  semantic: {
    label: 'Semantic Search',
    icon: Brain,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-violet-200 dark:border-violet-800',
    description: 'Ranked by relevance using vector similarity + BM25',
  },
  hybrid: {
    label: 'Hybrid Search',
    icon: Zap,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    description: 'Filtered by criteria, then ranked by relevance',
  },
};

export const ClinicAiAssistant: React.FC<ClinicAiAssistantProps> = ({ onSelectPatient }) => {
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState('All');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [showSources, setShowSources] = useState(false);

  const presets = [
    {
      label: 'BPPV Patients Over 50',
      query: 'List all patients with BPPV above age 50',
    },
    {
      label: 'Ménière\'s Medication Table',
      query: 'List all patients diagnosed with Ménière\'s Disease and summarize their prescribed medications in a structured table.',
    },
    {
      label: 'Vestibular Migraine & VNG',
      query: 'Which patients presented with Vestibular Migraine and what were their VNG test findings?',
    },
    {
      label: 'PPPD Patient Cases',
      query: 'Summarize cases of Persistent Postural-Perceptual Dizziness (PPPD) in our dataset.',
    },
  ];

  const handleRunRag = async (inputQuery?: string) => {
    const q = inputQuery || prompt;
    if (!q.trim() || loading) return;

    setLoading(true);
    setShowSources(false);
    try {
      const res = await queryRAG(q, scope, 20);
      setResponse(res);
    } catch (err) {
      console.error('RAG Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const queryTypeInfo = response?.query_type ? QUERY_TYPE_CONFIG[response.query_type] : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-extrabold font-heading text-slate-900 dark:text-slate-100 flex items-center gap-2">
          Clinic AI Assistant <Sparkles className="w-5 h-5 text-indigo-500" />
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Query patient records in natural language. Powered by Gemini &amp; ChromaDB Hybrid Search.
        </p>
      </div>

      {/* Preset Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sample Queries:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setPrompt(p.query);
              handleRunRag(p.query);
            }}
            className="px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Box Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleRunRag();
            }
          }}
          placeholder="Ask any clinical question (e.g. 'All BPPV patients above age 50', 'What treatments for vestibular migraine with anxiety?')..."
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors resize-y font-medium leading-relaxed"
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Filter Scope:</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none font-semibold"
            >
              <option value="All">All Patient Records</option>
              <option value="BPPV">BPPV Records Only</option>
              <option value="Ménière's Disease">Ménière&apos;s Records Only</option>
              <option value="Vestibular Migraine">Vestibular Migraine Only</option>
              <option value="PPPD">PPPD Records Only</option>
            </select>
          </div>

          <button
            disabled={loading || !prompt.trim()}
            onClick={() => handleRunRag()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Synthesizing Answer...' : 'Ask Clinic AI'}
          </button>
        </div>
      </div>

      {/* Response Box Card */}
      {response && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">
                Clinic AI Synthesis
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Verified against retrieved evaluation reports</span>
            </div>
          </div>

          {/* Query Type Badge + Stats */}
          {queryTypeInfo && (
            <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border ${queryTypeInfo.bg} ${queryTypeInfo.border}`}>
              <div className={`flex items-center gap-1.5 ${queryTypeInfo.color} text-xs font-bold`}>
                <queryTypeInfo.icon className="w-4 h-4" />
                {queryTypeInfo.label}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {queryTypeInfo.description}
              </span>
              <div className="ml-auto flex items-center gap-3 text-[11px] font-semibold">
                <span className={queryTypeInfo.color}>
                  {response.total_matching} patient{response.total_matching !== 1 ? 's' : ''} matched
                </span>
                {response.filters_applied && Object.keys(response.filters_applied).length > 0 && (
                  <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                    <Filter className="w-3 h-3" />
                    {Object.entries(response.filters_applied).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* React Markdown Rendering */}
          <div className="markdown-body text-xs leading-relaxed text-slate-800 dark:text-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response.answer}
            </ReactMarkdown>
          </div>

          {/* Sources Accordion */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex justify-between items-center w-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Retrieved Document Evidence ({response.total_sources} Sources Cited)
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showSources ? 'rotate-180' : ''}`} />
            </button>

            {showSources && (
              <div className="mt-3 space-y-2.5">
                {response.sources.map((src) => (
                  <div
                    key={src.patient_id}
                    onClick={() => onSelectPatient(src.patient_id)}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 cursor-pointer space-y-1 transition-all"
                  >
                    <div className="font-bold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      {src.name} ({src.filename})
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 font-medium">{src.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
