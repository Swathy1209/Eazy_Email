'use client';

import { useMemo, useState } from 'react';
import { ProgressBar } from '@/components/personalize/ProgressBar';

type QueueStatus = 'queued' | 'scheduled' | 'optimizing' | 'delayed' | 'completed';

type QueueRow = {
  id: string;
  lead: string;
  company: string;
  time: string;
  timezone: string;
  status: QueueStatus;
  confidence: number;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

const HEATMAP: number[][] = [
  [42, 58, 71, 65, 29, 22, 15],
  [54, 76, 87, 81, 35, 24, 19],
  [62, 91, 96, 92, 8, 31, 23],
  [46, 70, 82, 77, 7, 29, 21],
  [34, 52, 66, 62, 26, 18, 15],
  [21, 37, 49, 45, 19, 14, 12],
  [16, 24, 31, 28, 14, 11, 9],
  [12, 18, 24, 20, 10, 8, 7],
];

const INITIAL_QUEUE: QueueRow[] = [
  { id: 'Q-9231', lead: 'M. Al Farsi', company: 'Rayan Logistics', time: 'Tue 09:20', timezone: 'GST', status: 'queued', confidence: 93 },
  { id: 'Q-9232', lead: 'A. Narayan', company: 'Orbit SaaS', time: 'Wed 10:15', timezone: 'IST', status: 'scheduled', confidence: 89 },
  { id: 'Q-9233', lead: 'S. Rahman', company: 'Desert Freight', time: 'Thu 09:40', timezone: 'GST', status: 'optimizing', confidence: 86 },
  { id: 'Q-9234', lead: 'P. Mehta', company: 'ScaleIQ Labs', time: 'Fri 12:10', timezone: 'IST', status: 'delayed', confidence: 44 },
  { id: 'Q-9235', lead: 'L. Dsouza', company: 'Urban Estates', time: 'Tue 10:05', timezone: 'IST', status: 'completed', confidence: 95 },
];

function getCellStyle(value: number, day: string, hour: string) {
  if (day === 'Fri' && (hour === '10:00' || hour === '12:00')) {
    return 'bg-red-100 border-red-400/60 shadow-[0_0_10px_rgba(248,113,113,0.22)] dark:bg-red-500/35 dark:shadow-[0_0_14px_rgba(248,113,113,0.3)]';
  }
  if (value >= 92) {
    return 'bg-emerald-100 border-emerald-300/70 shadow-[0_0_10px_rgba(74,222,128,0.2)] dark:bg-emerald-400/35 dark:shadow-[0_0_16px_rgba(74,222,128,0.32)]';
  }
  if (value >= 80) {
    return 'bg-cyan-100 border-cyan-300/70 shadow-[0_0_10px_rgba(56,189,248,0.22)] dark:bg-cyan-400/35 dark:shadow-[0_0_16px_rgba(56,189,248,0.33)]';
  }
  if (value >= 58) {
    return 'bg-sky-100 border-sky-300/50 dark:bg-sky-500/25 dark:border-sky-400/40';
  }
  return 'bg-slate-100 border-slate-300 dark:bg-[#10263A]/80 dark:border-[#1B3D57]';
}

function statusStyle(status: QueueStatus) {
  if (status === 'completed') return 'text-emerald-700 border-emerald-400/40 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10';
  if (status === 'scheduled') return 'text-cyan-700 border-cyan-400/40 bg-cyan-50 dark:text-cyan-300 dark:bg-cyan-500/10';
  if (status === 'optimizing') return 'text-sky-700 border-sky-400/40 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/10';
  if (status === 'delayed') return 'text-amber-700 border-amber-400/40 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10';
  return 'text-slate-700 border-slate-300 bg-slate-100 dark:text-slate-300 dark:border-slate-500/40 dark:bg-slate-500/10';
}

export default function SendIntelligencePage() {
  const [hovered, setHovered] = useState<{ day: string; hour: string; value: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [queued, setQueued] = useState(1842);
  const [lift, setLift] = useState(27);
  const [confidence, setConfidence] = useState(91);
  const [queueRows, setQueueRows] = useState(INITIAL_QUEUE);

  const bestWindow = useMemo(() => {
    let best = { value: 0, day: 'Tue', hour: '09:00' };
    HEATMAP.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value > best.value) best = { value, day: DAYS[colIndex], hour: HOURS[rowIndex] };
      });
    });
    return best;
  }, []);

  const runAutoScheduler = async () => {
    if (running) return;
    setRunning(true);
    for (let i = 0; i < 4; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      setCycle(i + 1);
      setQueued((prev) => prev + 36 + i * 9);
      setLift((prev) => Math.min(41, prev + 2));
      setConfidence((prev) => Math.min(98, prev + 1));
      setQueueRows((prev) =>
        prev.map((row, index) => {
          if (index === i % prev.length) return { ...row, status: 'optimizing', confidence: Math.min(97, row.confidence + 2) };
          if (index === (i + 2) % prev.length) return { ...row, status: 'scheduled', confidence: Math.min(96, row.confidence + 1) };
          return row;
        }),
      );
    }
    setQueueRows((prev) =>
      prev.map((row, index) => (index % 2 === 0 ? { ...row, status: 'completed', confidence: Math.min(99, row.confidence + 3) } : row)),
    );
    setRunning(false);
    setCycle(0);
  };

  return (
    <section className="space-y-4 rounded-2xl bg-slate-50 p-4 text-slate-900 dark:bg-[#020812] dark:text-white">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-cyan-400/30 dark:bg-[linear-gradient(135deg,#06111F_0%,#081522_60%,#061423_100%)] dark:shadow-[0_0_0_1px_rgba(56,189,248,0.2)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.14),transparent_45%)] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.25),transparent_45%)]" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">AI Send-Time Operating System</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Send Intelligence</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Predictive delivery orchestration across GCC + India with timezone, behavior, and engagement-aware optimization.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-50 px-2.5 py-1 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-100">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
              F4 • GCC + INDIA AWARE
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              AI Send Optimization Active
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-50 px-2.5 py-1 text-sky-700 dark:bg-sky-500/10 dark:text-sky-100">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />
              Timezone Intelligence Enabled
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-cyan-400/20 dark:bg-[#06111F]/85 dark:shadow-[0_0_0_1px_rgba(56,189,248,0.12)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Send Probability Heatmap</p>
              <h2 className="text-lg font-semibold">Global Engagement Matrix</h2>
            </div>
            <span className="rounded-md border border-emerald-400/35 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              Best window: {bestWindow.day} {bestWindow.hour} ({bestWindow.value}%)
            </span>
          </div>

          <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#1E3A52] dark:bg-[#081522]/90">
            <div className="grid min-w-[720px] grid-cols-[86px_repeat(7,minmax(0,1fr))] gap-2 text-xs">
              <div />
              {DAYS.map((day) => (
                <div key={day} className="text-center font-medium text-slate-600 dark:text-slate-300">
                  {day}
                </div>
              ))}

              {HOURS.map((hour, rowIndex) => (
                <div key={hour} className="contents">
                  <div className="flex items-center text-slate-500 dark:text-slate-400">{hour}</div>
                  {DAYS.map((day, colIndex) => {
                    const value = HEATMAP[rowIndex][colIndex];
                    return (
                      <button
                        type="button"
                        key={`${day}-${hour}`}
                        className={`animate-heat-in h-9 rounded-md border text-[11px] text-slate-900 transition-all duration-500 hover:scale-[1.04] dark:text-slate-100 ${getCellStyle(value, day, hour)}`}
                        onMouseEnter={() => setHovered({ day, hour, value })}
                      >
                        {value}%
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {hovered ? (
              <div className="mt-3 rounded-md border border-cyan-400/30 bg-cyan-50 px-3 py-2 text-xs text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-100">
                {hovered.day} {hovered.hour} • Predicted open-rate {hovered.value}% • AI recommendation{' '}
                {hovered.value >= 85 ? 'Strong Send Window' : hovered.value <= 30 ? 'Avoid / Block' : 'Moderate Window'}
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded border border-cyan-400/30 bg-cyan-50 px-2 py-1 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200">Cyan = recommended</span>
            <span className="rounded border border-emerald-400/30 bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">Green = optimal</span>
            <span className="rounded border border-amber-400/30 bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">Amber = caution</span>
            <span className="rounded border border-red-400/30 bg-red-50 px-2 py-1 text-red-700 dark:bg-red-500/10 dark:text-red-200">Red = blocked window</span>
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-cyan-400/20 dark:bg-[#06111F]/85">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Recommended Windows</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">Regional Send Guidance</h3>
            <div className="mt-3 space-y-2.5">
              {[
                { label: 'Tue-Thu • 09:00-11:00 GST', region: 'GCC Logistics', open: 92, confidence: 95, badge: 'AI Priority' },
                { label: 'Mon-Wed • 10:00-12:00 IST', region: 'India SaaS', open: 88, confidence: 91, badge: 'AI Recommended' },
                { label: 'Fri • 11:30-13:30 GST', region: 'Prayer Window', open: 8, confidence: 97, badge: 'Block Window' },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-[#081522]/80">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{row.label}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        row.open < 30 ? 'border border-red-400/40 bg-red-500/10 text-red-200' : 'border border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                      }`}
                    >
                      {row.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.region}</p>
                  <div className="mt-2">
                    <ProgressBar
                      value={row.open}
                      fillClassName={row.open < 30 ? 'bg-gradient-to-r from-red-500 to-rose-400' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Open {row.open}%</span>
                    <span>Confidence {row.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-cyan-400/20 dark:bg-[#06111F]/85">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Auto-Scheduler Engine</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">AI Queue Automation</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#081522]/80">Contacts queued: <span className="text-cyan-700 dark:text-cyan-300">{queued.toLocaleString()}</span></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#081522]/80">Open-rate lift: <span className="text-emerald-700 dark:text-emerald-300">+{lift}%</span></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#081522]/80">AI confidence: <span className="text-cyan-700 dark:text-cyan-300">{confidence}%</span></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#081522]/80">Processing: <span className="text-sky-700 dark:text-sky-300">{running ? 'Streaming' : 'Ready'}</span></div>
            </div>
            <button
              type="button"
              onClick={() => void runAutoScheduler()}
              className="mt-3 w-full rounded-xl border border-cyan-300/70 bg-cyan-50 px-3 py-2.5 text-sm font-semibold text-cyan-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-100 dark:hover:bg-cyan-500/25 dark:hover:shadow-[0_0_20px_rgba(0,200,255,0.35)]"
            >
              {running ? `Running Auto-Scheduler ${'.'.repeat(cycle + 1)}` : 'Run Auto-Scheduler'}
            </button>
          </article>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          'Tuesday mornings perform 34% better for GCC logistics segments.',
          'Avoid Friday noon due to regional prayer-hour engagement drops.',
          'Indian SaaS leads respond strongest from 10 AM-12 PM IST.',
          'Real estate cohorts show higher engagement early weekdays.',
        ].map((insight) => (
          <article key={insight} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-cyan-400/20 dark:bg-[#06111F]/85">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-700/80 dark:text-cyan-300/70">AI Scheduling Insight</p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{insight}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-cyan-400/20 dark:bg-[#06111F]/85">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Live Queue Analytics</h3>
          <span className="inline-flex items-center gap-1 text-xs text-cyan-700 dark:text-cyan-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
            Live stream
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#1E3A52]">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 dark:bg-[#081522] dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Lead</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Scheduled Time</th>
                <th className="px-3 py-2 font-medium">Timezone</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">AI Confidence</th>
              </tr>
            </thead>
            <tbody>
              {queueRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 bg-white transition hover:bg-sky-50 dark:border-white/5 dark:bg-[#06111F]/80 dark:hover:bg-[#0A1A2A]">
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{row.lead}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.company}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.time}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.timezone}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] capitalize ${statusStyle(row.status)}`}>{row.status}</span>
                  </td>
                  <td className="px-3 py-2 text-cyan-700 dark:text-cyan-200">{row.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: 'Avg Open Rate Lift', value: `+${lift}%`, tone: 'text-emerald-300' },
          { label: 'AI Timing Accuracy', value: `${confidence}%`, tone: 'text-cyan-300' },
          { label: 'Emails Scheduled', value: queued.toLocaleString(), tone: 'text-sky-300' },
          { label: 'Best Region', value: 'GCC Logistics', tone: 'text-cyan-200' },
          { label: 'Queue Speed', value: '142 / min', tone: 'text-emerald-300' },
          { label: 'Timezone Coverage', value: '11 Zones', tone: 'text-cyan-300' },
        ].map((stat) => (
          <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-cyan-400/20 dark:bg-[#06111F]/85">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{stat.label}</p>
            <p className={`mt-2 text-lg font-semibold ${stat.tone}`}>{stat.value}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
