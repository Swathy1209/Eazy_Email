'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'moxsend-theme';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const darkEnabled = stored === 'dark';
    root.classList.toggle('dark', darkEnabled);
    setIsDark(darkEnabled);
  }, []);

  const handleToggle = () => {
    const next = !isDark;
    const root = document.documentElement;
    root.classList.toggle('dark', next);
    window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    setIsDark(next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed right-5 top-5 z-[100] inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-cyan-400/30 dark:bg-[#081522] dark:text-[#6B8CA5] dark:hover:border-cyan-400/60 dark:hover:text-white"
    >
      <span
        className={`h-2 w-2 rounded-full transition ${
          isDark ? 'bg-[#38BDF8] shadow-[0_0_12px_rgba(56,189,248,0.85)]' : 'bg-slate-400'
        }`}
      />
      {isDark ? 'Dark' : 'Light'}
    </button>
  );
}
