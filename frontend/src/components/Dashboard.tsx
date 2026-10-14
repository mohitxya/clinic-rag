'use client';

import React from 'react';
import { ClinicStats } from '@/types/clinic';
import { TrendingUp, TrendingDown, ArrowUpRight, Eye } from 'lucide-react';

interface DashboardProps {
  stats: ClinicStats | null;
  onSelectPatient: (patientId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, onSelectPatient, onNavigateTab }) => {
  if (!stats) return <div className="p-8 text-center text-slate-400">Loading Clinic Analytics...</div>;

  const bppvCount = stats.tag_distribution.find((t) => t.tag === 'BPPV')?.count || 0;
  const vmCount = stats.tag_distribution.find((t) => t.tag === 'Vestibular Migraine')?.count || 0;
  const mdCount = stats.tag_distribution.find((t) => t.tag === "Ménière's Disease")?.count || 0;

  const sampleRecentPatients = [
    { id: 'shuchika_deshmukh_VM_BPPV', date: '2023-10-13', name: 'Shuchika Deshmukh', age: 34, diagnosis: 'Vestibular Migraine & BPPV', status: 'Completed', statusColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    { id: 'saifuddin_faizi_VM_PPPD', date: '2023-10-20', name: 'Saifuddin Faizi', age: 48, diagnosis: 'Vestibular Migraine & PPPD', status: 'Follow-up', statusColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    { id: 'samiksha_supare_VM_Motion_otomy_reco__bppv_fibromyal', date: '2023-10-28', name: 'Samiksha Supare', age: 29, diagnosis: 'VM & Recovered BPPV', status: 'VNG Done', statusColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
    { id: 'prerna_bhattad_VM_POST_NEUROSURGERY', date: '2023-11-04', name: 'Mrs. Prerna Bhattad', age: 47, diagnosis: 'Vestibular Migraine (Post-Surgery)', status: 'Completed', statusColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 4 Metric Cards Row (Matching Top Cards in Image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 12% up
            </span>
            <span className="text-xs text-slate-400 font-medium">Cohort Volume</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Total Patient Files</span>
            <div className="text-3xl font-extrabold font-heading text-slate-900 dark:text-slate-100">{stats.total_patients}</div>
          </div>
          {/* Sparkline Bars */}
          <div className="flex items-end gap-1 h-7 pt-1">
            <div className="w-2 rounded-t bg-purple-200 dark:bg-purple-900/40 h-[40%]"></div>
            <div className="w-2 rounded-t bg-purple-300 dark:bg-purple-800/60 h-[60%]"></div>
            <div className="w-2 rounded-t bg-purple-400 dark:bg-purple-700/80 h-[35%]"></div>
            <div className="w-2 rounded-t bg-purple-500 h-[80%]"></div>
            <div className="w-2 rounded-t bg-purple-600 h-[100%]"></div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> 1% down
            </span>
            <span className="text-xs text-slate-400 font-medium">BPPV Diagnostics</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">BPPV Patients</span>
            <div className="text-3xl font-extrabold font-heading text-slate-900 dark:text-slate-100">{bppvCount}</div>
          </div>
          {/* Sparkline Bars */}
          <div className="flex items-end gap-1 h-7 pt-1">
            <div className="w-2 rounded-t bg-rose-200 dark:bg-rose-900/40 h-[80%]"></div>
            <div className="w-2 rounded-t bg-rose-300 dark:bg-rose-800/60 h-[50%]"></div>
            <div className="w-2 rounded-t bg-rose-400 dark:bg-rose-700/80 h-[90%]"></div>
            <div className="w-2 rounded-t bg-rose-500 h-[40%]"></div>
            <div className="w-2 rounded-t bg-rose-600 h-[65%]"></div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 3% up
            </span>
            <span className="text-xs text-slate-400 font-medium">Migraine Cases</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Vestibular Migraine</span>
            <div className="text-3xl font-extrabold font-heading text-slate-900 dark:text-slate-100">{vmCount}</div>
          </div>
          {/* Sparkline Bars */}
          <div className="flex items-end gap-1 h-7 pt-1">
            <div className="w-2 rounded-t bg-emerald-200 dark:bg-emerald-900/40 h-[30%]"></div>
            <div className="w-2 rounded-t bg-emerald-300 dark:bg-emerald-800/60 h-[55%]"></div>
            <div className="w-2 rounded-t bg-emerald-400 dark:bg-emerald-700/80 h-[70%]"></div>
            <div className="w-2 rounded-t bg-emerald-500 h-[85%]"></div>
            <div className="w-2 rounded-t bg-emerald-600 h-[100%]"></div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> 3% down
            </span>
            <span className="text-xs text-slate-400 font-medium">Ménière&apos;s Cohort</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Ménière&apos;s Disease</span>
            <div className="text-3xl font-extrabold font-heading text-slate-900 dark:text-slate-100">{mdCount}</div>
          </div>
          {/* Sparkline Bars */}
          <div className="flex items-end gap-1 h-7 pt-1">
            <div className="w-2 rounded-t bg-amber-200 dark:bg-amber-900/40 h-[75%]"></div>
            <div className="w-2 rounded-t bg-amber-300 dark:bg-amber-800/60 h-[60%]"></div>
            <div className="w-2 rounded-t bg-amber-400 dark:bg-amber-700/80 h-[45%]"></div>
            <div className="w-2 rounded-t bg-amber-500 h-[50%]"></div>
            <div className="w-2 rounded-t bg-amber-600 h-[35%]"></div>
          </div>
        </div>
      </div>

      {/* Middle Section: Main Chart + Side Donut Breakdown (Exact Match to Image) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Area Chart Card */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-slate-100">
                Evaluation Statistics (Patient Growth)
              </h3>
              <p className="text-xs text-slate-400">Monthly patient intake and VNG evaluation trends.</p>
            </div>
            <select className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none">
              <option>Monthly</option>
              <option>Quarterly</option>
            </select>
          </div>

          {/* SVG Smooth Area Chart (Matching Image Purple Gradient) */}
          <div className="relative h-64 w-full pt-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="purpleArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="#334155" strokeDasharray="4 4" strokeOpacity="0.2" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#334155" strokeDasharray="4 4" strokeOpacity="0.2" />
              <line x1="0" y1="130" x2="500" y2="130" stroke="#334155" strokeDasharray="4 4" strokeOpacity="0.2" />

              {/* Area Path */}
              <path
                d="M 0,140 Q 100,50 200,90 T 400,30 L 500,70 L 500,180 L 0,180 Z"
                fill="url(#purpleArea)"
              />
              {/* Line Path */}
              <path
                d="M 0,140 Q 100,50 200,90 T 400,30 L 500,70"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>

            {/* X Axis Labels */}
            <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 pt-3">
              <div>Jul 10 <span className="block text-slate-900 dark:text-slate-100 font-bold">360</span></div>
              <div>Aug 14 <span className="block text-purple-600 dark:text-purple-400 font-bold">580</span></div>
              <div>Sep 20 <span className="block text-slate-900 dark:text-slate-100 font-bold">576</span></div>
              <div>Oct 24 <span className="block text-slate-900 dark:text-slate-100 font-bold">945</span></div>
              <div>Nov 30 <span className="block text-slate-900 dark:text-slate-100 font-bold">456</span></div>
            </div>
          </div>
        </div>

        {/* Right Panel: Donut Chart (Matching "Passed Issued By Time" Ring in Image) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold font-heading text-slate-900 dark:text-slate-100">
              Diagnostic Breakdown
            </h3>
            <select className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 border-none outline-none">
              <option>Weekly</option>
            </select>
          </div>

          {/* Donut Ring */}
          <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-indigo-600 stroke-current"
                strokeWidth="4"
                strokeDasharray="44, 100"
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-purple-500 stroke-current"
                strokeWidth="4"
                strokeDasharray="28, 100"
                strokeDashoffset="-44"
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500 stroke-current"
                strokeWidth="4"
                strokeDasharray="21, 100"
                strokeDashoffset="-72"
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-heading block">+78%</span>
              <span className="text-[10px] text-slate-400 font-medium">Resolution Rate</span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300 pt-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> BPPV Patients
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">44% ({bppvCount})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Vestibular Migraine
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">28% ({vmCount})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Ménière&apos;s Disease
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">21% ({mdCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Table: Recent Patients (Matching Table in Image) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-slate-100">
              Registered Patient Evaluations
            </h3>
            <p className="text-xs text-slate-400">Recent clinical reports and VNG test outcomes.</p>
          </div>
          <button
            onClick={() => onNavigateTab('patients')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
          >
            View Full Directory <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Age</th>
                <th className="py-3 px-4">Diagnosis</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {sampleRecentPatients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-medium">{p.date}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-[10px]">
                      {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <span>{p.name}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">{p.age} yrs</td>
                  <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">{p.diagnosis}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${p.statusColor}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onSelectPatient(p.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                      title="View Report"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
