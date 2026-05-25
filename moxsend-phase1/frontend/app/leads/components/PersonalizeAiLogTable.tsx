'use client';

import type { PersonalizeTelemetry } from '@/lib/personalize-telemetry';

export type PersonalizeAiLogRow = PersonalizeTelemetry & {
  id: string;
  at: number;
  variant: 'A' | 'B';
  errorMessage?: string;
  /** Supabase event_type when row came from DB */
  eventType?: string;
};

function statusStyles(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-emerald-50 text-emerald-900 ring-emerald-200/80';
    case 'INVALID_OUTPUT':
    case 'VALIDATION_FAILED':
      return 'bg-amber-50 text-amber-950 ring-amber-200/80';
    case 'TIMEOUT':
      return 'bg-violet-50 text-violet-900 ring-violet-200/80';
    case 'RETRYING':
      return 'bg-sky-50 text-sky-900 ring-sky-200/80';
    case 'FAILED':
    default:
      return 'bg-red-50 text-red-900 ring-red-200/80';
  }
}

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(ts);
}

type Props = {
  logs: PersonalizeAiLogRow[];
  onClear: () => void;
  /** false when SUPABASE_SERVICE_ROLE_KEY + URL are missing (server cannot persist). */
  dbConfigured?: boolean;
  dbHint?: string | null;
};

export function PersonalizeAiLogTable({ logs, onClear, dbConfigured = true, dbHint = null }: Props) {
  return (
    <div
      className="flex max-h-[min(380px,50vh)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
      aria-labelledby="personalize-ai-log-heading"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-3">
        <div>
          <h2 id="personalize-ai-log-heading" className="text-sm font-semibold text-slate-900">
            AI generation log
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Groq calls from <span className="font-medium text-slate-600">Generate</span> /{' '}
            <span className="font-medium text-slate-600">Regenerate</span>. This table merges browser session history with
            Supabase when the service role is configured on the Next.js server.
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={logs.length === 0}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      {!dbConfigured ? (
        <div className="border-b border-amber-100 bg-amber-50/90 px-4 py-2 text-[11px] text-amber-950">
          <span className="font-semibold">Supabase logging off.</span>{' '}
          {dbHint ?? 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local at the repo root, then restart dev.'}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        {logs.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400">
            Run <span className="font-medium text-slate-500">Generate for cohort</span> to see timestamps, token usage,
            and status for each variant.
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-[11px] sm:text-xs">
            <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-white/95 backdrop-blur-sm">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4">
                  Time
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4">Event</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4">Var</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4">Status</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4">
                  Tokens in/out
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4">
                  Groq ms
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4">
                  Total ms
                </th>
                <th className="min-w-[7rem] px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4">
                  Trace
                </th>
                <th className="min-w-[8rem] px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4">
                  Note
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((row) => (
                <tr key={row.id} className="bg-white hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-slate-500 sm:px-4">
                    {formatTime(row.at)}
                  </td>
                  <td className="max-w-[6.5rem] truncate px-3 py-2 font-mono text-[10px] text-slate-600 sm:px-4" title={row.eventType}>
                    {row.eventType ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-700 sm:px-4">{row.variant}</td>
                  <td className="px-3 py-2 sm:px-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 sm:text-[11px] ${statusStyles(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600 sm:px-4">
                    {row.tokenInput != null || row.tokenOutput != null ? (
                      <>
                        {row.tokenInput ?? '—'} / {row.tokenOutput ?? '—'}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600 sm:px-4">
                    {row.providerLatencyMs != null ? row.providerLatencyMs : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600 sm:px-4">
                    {row.processingTimeMs}
                  </td>
                  <td className="max-w-[7rem] truncate px-3 py-2 font-mono text-[10px] text-slate-500 sm:px-4" title={row.traceId}>
                    {row.traceId.slice(0, 8)}…
                  </td>
                  <td className="break-words px-3 py-2 text-slate-600 sm:px-4">
                    {row.errorMessage
                      ? row.errorMessage
                      : row.model
                        ? row.model
                        : row.retryCount
                          ? `Retries: ${row.retryCount}`
                          : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
