'use client';

import { ProgressBar } from './ProgressBar';

type Tone = 'cyan' | 'emerald' | 'amber';

const TONE_CLASS: Record<Tone, string> = {
  cyan: 'progress-fill-cyan',
  emerald: 'progress-fill-emerald',
  amber: 'progress-fill-amber',
};

type ScoreBarProps = {
  label: React.ReactNode;
  value: number;
  tone: Tone;
  className?: string;
  compact?: boolean;
};

export function ScoreBar({ label, value, tone, className = '', compact = false }: ScoreBarProps) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50/90 p-2.5 dark:border-[#38BDF8]/20 dark:bg-[#06111F]/70 ${className}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-1 text-[11px]' : 'mb-1 text-xs'}`}>
        <span className={`truncate text-slate-500 dark:text-[#6B8CA5] ${compact ? 'pr-1' : ''}`}>{label}</span>
        <span className={`shrink-0 font-semibold text-slate-800 dark:text-white ${compact ? 'text-xs' : ''}`}>{safeValue}%</span>
      </div>
      <ProgressBar value={safeValue} fillClassName={TONE_CLASS[tone]} />
    </div>
  );
}
