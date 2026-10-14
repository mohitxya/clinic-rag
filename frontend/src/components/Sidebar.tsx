'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Activity,
  PieChart,
  Settings,
  HelpCircle,
  Stethoscope,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  indexedCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, indexedCount }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patient Directory', icon: Users },
    { id: 'rag', label: 'Ask Clinic AI', icon: MessageSquare },
  ];

  return (
    <aside className="w-64 bg-[#0F0F1E] text-slate-300 flex flex-col justify-between p-5 min-h-screen border-r border-slate-800/60 sticky top-0 h-screen select-none">
      <div className="space-y-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-lg text-white tracking-tight flex items-center gap-1">
              Clinic<span className="text-indigo-400">RAG</span>
            </h1>
            <span className="text-[11px] text-slate-400 font-medium block">ENT & Vertigo AI</span>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="space-y-1.5">
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Main Menu
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.id === 'rag' && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Secondary Menu */}
        <div className="space-y-1.5 pt-4 border-t border-slate-800/60">
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Management
          </span>
          <button
            onClick={() => setActiveTab('patients')}
            className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 transition-colors"
          >
            <Activity className="w-4 h-4 text-slate-400" />
            <span>VNG Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 transition-colors"
          >
            <PieChart className="w-4 h-4 text-slate-400" />
            <span>Reports</span>
          </button>
          <button
            onClick={() => setActiveTab('rag')}
            className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>RAG Engine Config</span>
          </button>
        </div>
      </div>

      {/* Bottom Promo Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-900 border border-indigo-500/20 text-center space-y-3 shadow-xl">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-200">Clinic RAG Intelligence</h4>
          <p className="text-[11px] text-slate-400 mt-1">{indexedCount} Evaluation Files Indexed</p>
        </div>
        <button
          onClick={() => setActiveTab('rag')}
          className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
        >
          Consult AI Assistant
        </button>
      </div>
    </aside>
  );
};
