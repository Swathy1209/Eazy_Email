'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProgressBar } from '@/components/personalize/ProgressBar';
import { requestSubjectOptimizer } from '@/lib/subject-optimizer';

type Suggestion = {
  id: string;
  subject: string;
  explanation: string;
  score: number;
  label: 'Best' | 'High' | 'Good' | 'Medium' | 'Low';
};

const scorePalette = {
  best: {
    tone: 'text-emerald-500 dark:text-emerald-300',
    bar: 'from-emerald-400 via-emerald-300 to-emerald-500',
    border: 'border-emerald-300 dark:border-emerald-400/45',
    glow: 'hover:shadow-[0_0_24px_rgba(16,185,129,0.15)] dark:hover:shadow-[0_0_24px_rgba(16,185,129,0.22)]',
  },
  good: {
    tone: 'text-cyan-600 dark:text-cyan-300',
    bar: 'from-cyan-400 via-sky-300 to-cyan-500',
    border: 'border-cyan-300 dark:border-cyan-400/45',
    glow: 'hover:shadow-[0_0_24px_rgba(34,211,238,0.15)] dark:hover:shadow-[0_0_24px_rgba(34,211,238,0.22)]',
  },
  medium: {
    tone: 'text-amber-500 dark:text-amber-300',
    bar: 'from-amber-400 via-yellow-300 to-amber-500',
    border: 'border-amber-300 dark:border-amber-400/45',
    glow: 'hover:shadow-[0_0_24px_rgba(251,191,36,0.15)] dark:hover:shadow-[0_0_24px_rgba(251,191,36,0.2)]',
  },
  low: {
    tone: 'text-rose-500 dark:text-rose-300',
    bar: 'from-rose-400 via-red-300 to-red-500',
    border: 'border-rose-300 dark:border-rose-400/45',
    glow: 'hover:shadow-[0_0_24px_rgba(248,113,113,0.15)] dark:hover:shadow-[0_0_24px_rgba(248,113,113,0.2)]',
  },
};

function getScoreLabel(score: number): Suggestion['label'] {
  if (score >= 88) return 'Best';
  if (score >= 78) return 'High';
  if (score >= 66) return 'Good';
  if (score >= 50) return 'Medium';
  return 'Low';
}

function getScoreTheme(score: number) {
  if (score >= 78) return scorePalette.best;
  if (score >= 66) return scorePalette.good;
  if (score >= 50) return scorePalette.medium;
  return scorePalette.low;
}

interface SubjectOptimizerProps {
  initialSubject: string;
  onSelect: (subject: string) => void;
  onClose: () => void;
  leadContext?: string;
  offerContext?: string;
}

export function SubjectOptimizer({ initialSubject, onSelect, onClose, leadContext = '', offerContext = '' }: SubjectOptimizerProps) {
  const [input, setInput] = useState(initialSubject || '');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [streamedSubjects, setStreamedSubjects] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInput(initialSubject || '');
    setResults([]);
  }, [initialSubject]);

  const canGenerate = input.trim().length > 5;

  const avgScore = useMemo(() => {
    if (!results.length) return 0;
    return Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length);
  }, [results]);

  const bestScore = useMemo(() => {
    if (!results.length) return 0;
    return Math.max(...results.map((item) => item.score));
  }, [results]);

  useEffect(() => {
    if (!results.length) return;

    const timers: number[] = [];
    setStreamedSubjects({});

    results.forEach((result, rowIndex) => {
      const revealDelay = rowIndex * 220;
      const rowTimer = window.setTimeout(() => {
        let charIndex = 0;
        const charTimer = window.setInterval(() => {
          charIndex += 2;
          setStreamedSubjects((prev) => ({
            ...prev,
            [result.id]: result.subject.slice(0, charIndex),
          }));
          if (charIndex >= result.subject.length) {
            window.clearInterval(charTimer);
          }
        }, 18);
        timers.push(charTimer);
      }, revealDelay);
      timers.push(rowTimer);
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [results]);

  const runOptimizer = async () => {
    if (!canGenerate) return;
    setRunning(true);
    setResults([]);
    setError(null);
    try {
      const response = await requestSubjectOptimizer({
        subject_input: input.trim(),
        lead_context: leadContext,
        offer_context: offerContext,
        tone: 'Professional',
      });

      if (!response.success || !response.variants?.length) {
        throw new Error(response.error || 'No subject variants returned');
      }

      const generated: Suggestion[] = response.variants.slice(0, 5).map((item, index) => ({
        id: String(item.id ?? index + 1),
        subject: String(item.subject ?? '').trim(),
        explanation: String(item.angle ?? '').trim() || 'AI angle: optimized for open-rate potential.',
        score: Math.max(0, Math.min(100, Math.round(Number(item.score) || 0))),
        label: (item.label as Suggestion['label']) || getScoreLabel(Math.max(0, Math.min(100, Math.round(Number(item.score) || 0)))),
      }));

      setResults(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Subject optimization failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-300 ease-out space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm dark:border-[#38BDF8]/20 dark:bg-[#06111F]/80">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-[#6B8CA5]">
          AI Subject Refinement
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Close optimizer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask AI to refine this subject..."
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 dark:border-[#38BDF8]/30 dark:bg-[#050B14]/90 dark:text-slate-100 dark:focus:border-cyan-300"
        />
        <button
          type="button"
          onClick={() => void runOptimizer()}
          disabled={!canGenerate || running}
          className="whitespace-nowrap rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-100 disabled:opacity-45 dark:border-cyan-400/60 dark:bg-cyan-400/10 dark:text-cyan-100 dark:hover:bg-cyan-400/20"
        >
          {running ? 'Optimizing...' : 'Generate Variants'}
        </button>
      </div>

      {running ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white/50 px-4 py-3 dark:border-cyan-400/20 dark:bg-[#08111B]/75">
              <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10" />
              <div className="mt-3 h-3 w-2/3 rounded bg-slate-200 dark:bg-white/10" />
              <div className="mt-2 h-2 w-full rounded bg-slate-200 dark:bg-white/10" />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-400/45 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      {results.length ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm dark:border-cyan-400/20 dark:bg-[#050B14]/75 dark:text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4 text-cyan-500 dark:text-cyan-400" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>
              Avg score: <span className="font-semibold text-slate-700 dark:text-slate-100">{avgScore}%</span> • Top performer:{' '}
              <span className="font-semibold text-emerald-600 dark:text-emerald-300">{bestScore}%</span>
            </span>
          </div>

          <div className="space-y-2.5">
            {results.map((item, index) => {
              const visual = getScoreTheme(item.score);
              const streamed = streamedSubjects[item.id] ?? '';
              return (
                <article
                  key={item.id}
                  className={`group rounded-xl border bg-white p-3 shadow-sm transition duration-300 dark:bg-[#08111B]/85 ${visual.border} ${visual.glow}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-200">
                          #{index + 1}
                        </span>
                        <p className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {streamed}
                          {streamed.length < item.subject.length ? <span className="ml-0.5 animate-pulse text-cyan-500 dark:text-cyan-300">|</span> : null}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.explanation}</p>
                    </div>

                    <div className="w-32 shrink-0 sm:w-40">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${visual.tone}`}>{item.score}%</span>
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] ${visual.border} ${visual.tone}`}>{item.label}</span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={item.score} fillClassName={`bg-gradient-to-r ${visual.bar}`} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(item.subject)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-cyan-400/40 dark:hover:text-cyan-100"
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(item.subject);
                        setCopiedId(item.id);
                        window.setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 1300);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-cyan-400/35 dark:bg-cyan-400/10 dark:text-cyan-100 dark:hover:border-cyan-300/70 dark:hover:bg-cyan-400/20"
                    >
                      {copiedId === item.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
