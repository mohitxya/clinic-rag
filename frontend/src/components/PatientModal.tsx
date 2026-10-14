'use client';

import React, { useState, useEffect } from 'react';
import { Patient } from '@/types/clinic';
import { fetchPatientDetail } from '@/lib/api';
import { X, Calendar, User } from 'lucide-react';

interface PatientModalProps {
  patientId: string | null;
  onClose: () => void;
}

export const PatientModal: React.FC<PatientModalProps> = ({ patientId, onClose }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'vng' | 'treatment' | 'raw'>('overview');

  useEffect(() => {
    if (!patientId) return;

    let isMounted = true;
    const load = async () => {
      try {
        const p = await fetchPatientDetail(patientId);
        if (isMounted) {
          setPatient(p);
        }
      } catch (err) {
        console.error('Error fetching patient details:', err);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [patientId]);

  if (!patientId || !patient) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl glass-card overflow-hidden relative border border-white/10 bg-slate-900/90 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-2 rounded-full hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-2xl font-bold text-slate-100">{patient.name}</h2>
            <div className="flex flex-wrap gap-1.5">
              {patient.tags.map((t) => (
                <span key={t} className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {patient.age ? `${patient.age} yrs` : 'Age Unspecified'} / {patient.gender || 'Sex Unspecified'}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Exam Date: <strong className="text-slate-200">{patient.date_of_exam}</strong></span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-slate-950/60 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'overview' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Clinical Summary
          </button>
          <button
            onClick={() => setActiveTab('vng')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'vng' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            VNG & Investigations
          </button>
          <button
            onClick={() => setActiveTab('treatment')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'treatment' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Diagnosis & Treatment
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'raw' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Full Report Text
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Clinical History</h4>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{patient.history || 'No history recorded.'}</p>
              </div>
              {patient.past_history && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Past Medical History</h4>
                  <p className="text-sm text-slate-200 leading-relaxed">{patient.past_history}</p>
                </div>
              )}
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">ENT & Neurotological Examination</h4>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {(patient.ent_exam + '\n\n' + patient.neuro_exam + '\n\n' + patient.neurotological_exam).trim()}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'vng' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Previous Investigations (MRI / PTA)</h4>
                <p className="text-sm text-slate-200">{patient.investigations || 'No MRI/PTA recorded.'}</p>
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Video Nystagmography (VNG) Test Findings</h4>
                <pre className="p-4 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {patient.vng_results || 'VNG parameters normal.'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'treatment' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Clinical Impression / Diagnostic Verdict</h4>
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-semibold text-sm">
                  {patient.clinical_impression}
                </div>
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Prescribed Treatment & Maneuvers</h4>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{patient.treatment || 'No treatment plan recorded.'}</p>
              </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <pre className="p-4 rounded-xl bg-slate-950/90 border border-white/10 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
              {patient.full_text}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
