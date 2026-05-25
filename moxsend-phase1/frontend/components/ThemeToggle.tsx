'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'moxsend-theme';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem(STORAGE_KEY, mode);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial: ThemeMode = stored === 'light' ? 'light' : root.classList.contains('dark') ? 'dark' : 'light';
    setMode(initial);
  }, []);

  const switchMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    applyTheme(next);
  };

  const isDark = mode === 'dark';
  const label = isDark ? 'Light mode' : 'Dark mode';

  return (
    <button
      type="button"
      onClick={switchMode}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#38BDF8]/30 bg-[#06111F] px-3 py-2 text-sm text-[#CBEFFF] shadow-sm transition hover:border-[#38BDF8]/55 hover:bg-[#081522] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
      aria-label={label}
      title={label}
    >
      {isDark ? (
        <>
          <svg className="h-4 w-4 text-[#FBBF24]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v2.25m0 13.5V21m9-9h-2.25M5.25 12H3m14.364 6.364l-1.591-1.591M8.227 8.227 6.636 6.636m10.728 0-1.591 1.591M8.227 15.773l-1.591 1.591M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>Light</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0112 21c-5.385 0-9.75-4.365-9.75-9.75 0-4.199 2.654-7.778 6.377-9.159a.75.75 0 01.95.95A7.5 7.5 0 0019.96 13.423a.75.75 0 01.95.95l-.158.629z" />
          </svg>
          <span>Dark</span>
        </>
      )}
    </button>
  );
}
