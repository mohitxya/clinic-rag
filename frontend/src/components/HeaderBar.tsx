'use client';

import React from 'react';
import { Search, Sun, Moon } from 'lucide-react';

interface HeaderBarProps {
  theme: string;
  toggleTheme: () => void;
  onSearchChange?: (query: string) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ theme, toggleTheme, onSearchChange }) => {
  return (
    <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/80">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold font-heading text-slate-900 dark:text-slate-100 flex items-center gap-2">
          Good Morning, Dr. Acharya <span className="animate-bounce">👋</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
          Manage your patients with Vertigo & VNG intelligence powered by Gemini 3.6 Hybrid RAG.
        </p>
      </div>

      {/* Quick Search & Actions */}
      <div className="flex items-center gap-3.5 w-full md:w-auto">
        <div className="flex-1 md:w-72 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-all">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search anything (e.g. BPPV, Epley)..."
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            className="w-full bg-transparent outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 font-medium"
          />
        </div>

        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shadow">
            DA
          </div>
          <div className="hidden sm:block text-left pr-1">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block leading-tight">
              Dr. Amol Acharya
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
              Chief ENT & Vertigo
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
