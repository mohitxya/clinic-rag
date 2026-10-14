'use client';

import React, { useState, useEffect } from 'react';
import { ClinicStats, TagCount } from '@/types/clinic';
import { fetchStats, fetchTags } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { Dashboard } from '@/components/Dashboard';
import { PatientDirectory } from '@/components/PatientDirectory';
import { PatientModal } from '@/components/PatientModal';
import { ClinicAiAssistant } from '@/components/ClinicAiAssistant';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [stats, setStats] = useState<ClinicStats | null>(null);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('clinic_theme') || 'dark';
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
      requestAnimationFrame(() => setTheme('light'));
    } else {
      document.documentElement.classList.add('dark');
    }

    const load = async () => {
      try {
        const [sData, tData] = await Promise.all([fetchStats(), fetchTags()]);
        setStats(sData);
        setTags(tData);
      } catch (err) {
        console.error('Error initializing app data:', err);
      }
    };
    load();
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('clinic_theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#0B0C15] text-slate-900 dark:text-slate-100 flex font-sans transition-colors duration-200">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        indexedCount={stats?.total_patients || 576}
      />

      {/* Main Content Body */}
      <div className="flex-1 p-6 md:p-8 space-y-6 max-w-[1600px] overflow-y-auto">
        <HeaderBar
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <main>
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              onSelectPatient={(pid) => setSelectedPatientId(pid)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}
          {activeTab === 'patients' && (
            <PatientDirectory tags={tags} onSelectPatient={(pid) => setSelectedPatientId(pid)} />
          )}
          {activeTab === 'rag' && (
            <ClinicAiAssistant onSelectPatient={(pid) => setSelectedPatientId(pid)} />
          )}
        </main>

        <PatientModal
          patientId={selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
        />
      </div>
    </div>
  );
}
