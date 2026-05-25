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
    tone: 'text-emerald-300',
    bar: 'from-emerald-400 via-emerald-300 to-emerald-500',
    border: 'border-emerald-400/45',
    glow: 'hover:shadow-[0_0_24px_rgba(16,185,129,0.22)]',
  },
  good: {
    tone: 'text-cyan-300',
    bar: 'from-cyan-400 via-sky-300 to-cyan-500',
    border: 'border-cyan-400/45',
    glow: 'hover:shadow-[0_0_24px_rgba(34,211,238,0.22)]',
  },
  medium: {
    tone: 'text-amber-300',
    bar: 'from-amber-400 via-yellow-300 to-amber-500',
    border: 'border-amber-400/45',
    glow: 'hover:shadow-[0_0_24px_rgba(251,191,36,0.2)]',
  },
  low: {
    tone: 'text-rose-300',
    bar: 'from-rose-400 via-red-300 to-red-500',
    border: 'border-rose-400/45',
    glow: 'hover:shadow-[0_0_24px_rgba(248,113,113,0.2)]',
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

export default function SubjectOptimizerPage() {
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [streamedSubjects, setStreamedSubjects] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setSelectedId(null);
    setError(null);
    try {
      const response = await requestSubjectOptimizer({
        subject_input: input.trim(),
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
    <section className="space-y-4 text-white">
      <header className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#07101A]/85 p-4 shadow-[0_0_0_1px_rgba(34,211,238,0.22)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_50%)]" />
        <div className="relative z-10">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300/70">AI Subject Intelligence Engine</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">Subject Optimizer Command Panel</h1>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-400">
            Generate premium subject line variants with AI-native scoring, ranked intent signals, and real-time insight.
          </p>
         
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">5 Variants Generated</span>
            <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">AI Scored</span>
            <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">Reply Optimized</span>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-cyan-400/25 bg-[#07101A]/75 p-4 shadow-[0_0_0_1px_rgba(34,211,238,0.14)]">
        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Original Subject Line</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. Quick pilot idea for your outbound team"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition duration-300 placeholder:text-slate-500 focus:border-cyan-400 dark:border-cyan-400/35 dark:bg-[#050B14]/90 dark:text-slate-100 dark:focus:border-cyan-300 dark:focus:shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_0_20px_rgba(34,211,238,0.2)]"
          />
          <button
            type="button"
            onClick={() => void runOptimizer()}
            disabled={!canGenerate || running}
            className="rounded-xl border border-cyan-300/70 bg-cyan-400/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition duration-300 hover:translate-y-[-1px] hover:bg-cyan-400/25 hover:shadow-[0_0_18px_rgba(34,211,238,0.24)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? 'Optimizing...' : 'Optimize -> Generate Variants'}
          </button>
        </div>
      </div>

      {!results.length && !running ? (
        <div className="rounded-2xl border border-dashed border-cyan-400/25 bg-[#050B14]/70 p-10 text-center text-sm text-slate-400">
          Enter your base subject line and launch the AI intelligence engine.
        </div>
      ) : null}

      {running ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl border border-cyan-400/20 bg-[#08111B]/75 px-4 py-3">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="mt-3 h-3 w-2/3 rounded bg-white/10" />
              <div className="mt-2 h-2 w-full rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {results.length ? (
        <>
          <div className="rounded-xl border border-cyan-400/20 bg-[#050B14]/75 px-3 py-2 text-xs text-slate-400">
            Score intelligence: avg <span className="font-semibold text-slate-100">{avgScore}%</span> | top performer{' '}
            <span className="font-semibold text-emerald-300">{bestScore}%</span>
          </div>

          <div className="space-y-2.5">
            {results.map((item, index) => {
              const visual = getScoreTheme(item.score);
              const streamed = streamedSubjects[item.id] ?? '';
              return (
              <article
                key={item.id}
                className={`animate-fade-in group rounded-xl border bg-[#08111B]/85 p-3 transition duration-300 ${visual.border} ${visual.glow} ${
                  selectedId === item.id ? 'shadow-[0_0_0_1px_rgba(34,211,238,0.35)]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-white/15 bg-white/5 px-1.5 text-[11px] font-semibold text-slate-200">
                        #{index + 1}
                      </span>
                      <p className="line-clamp-1 text-sm font-semibold text-slate-100">
                        {streamed}
                        {streamed.length < item.subject.length ? <span className="ml-0.5 animate-pulse text-cyan-300">|</span> : null}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">{item.explanation}</p>
                  </div>

                  <div className="w-40 shrink-0">
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
                    onClick={async () => {
                      await navigator.clipboard.writeText(item.subject);
                      setCopiedId(item.id);
                      window.setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 1300);
                    }}
                    className="rounded-lg border border-cyan-400/35 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-400/20"
                  >
                    {copiedId === item.id ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-100"
                  >
                    {selectedId === item.id ? 'In Use' : 'Use'}
                  </button>
                </div>
              </article>
              );
            })}
          </div>

          <section className="rounded-2xl border border-cyan-400/20 bg-[#050B14]/85 p-4">
            <div className="mb-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/75">AI Insights</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">Performance Analytics Cards</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-xl border border-cyan-400/20 bg-[#091422]/80 p-3">
                <p className="text-xs text-slate-400">Why these variants work</p>
                <p className="mt-1 text-sm text-slate-200">Ranked variants balance curiosity, urgency, and context alignment to maximize opens and replies.</p>
              </article>
              <article className="rounded-xl border border-cyan-400/20 bg-[#091422]/80 p-3">
                <p className="text-xs text-slate-400">Subject length analysis</p>
                <p className="mt-1 text-sm text-slate-200">
                  Avg length {Math.round(results.reduce((sum, row) => sum + row.subject.length, 0) / results.length)} chars, optimized for preview windows.
                </p>
              </article>
              <article className="rounded-xl border border-cyan-400/20 bg-[#091422]/80 p-3">
                <p className="text-xs text-slate-400">Mobile optimization insights</p>
                <p className="mt-1 text-sm text-slate-200">Top variants front-load intent keywords to prevent truncation on mobile inbox clients.</p>
              </article>
              <article className="rounded-xl border border-cyan-400/20 bg-[#091422]/80 p-3">
                <p className="text-xs text-slate-400">GCC email behavior recommendations</p>
                <p className="mt-1 text-sm text-slate-200">Use respectful urgency and role-aware context framing to improve enterprise engagement in GCC segments.</p>
              </article>
              <article className="rounded-xl border border-cyan-400/20 bg-[#091422]/80 p-3">
                <p className="text-xs text-slate-400">Curiosity gap analysis</p>
                <p className="mt-1 text-sm text-slate-200">Best performer opens an information loop without sounding vague, increasing safe curiosity-driven opens.</p>
              </article>
              <article className="rounded-xl border border-cyan-400/20 bg-[#091422]/80 p-3">
                <p className="text-xs text-slate-400">Personalization insights</p>
                <p className="mt-1 text-sm text-slate-200">Company and team-based anchors improve perceived relevance while maintaining clean enterprise tone.</p>
              </article>
            </div>

          </section>
        </>
      ) : null}
    </section>
  );
}
