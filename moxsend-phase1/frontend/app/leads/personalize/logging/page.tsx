'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AiGenerationLogDbRow } from '@/lib/ai-generation-log';

type ApiResponse = {
  ok?: boolean;
  configured?: boolean;
  hint?: string;
  items?: AiGenerationLogDbRow[];
};

function statusColor(status: string): string {
  if (status === 'SUCCESS') return 'status-chip status-chip-success';
  if (status === 'RETRYING') return 'status-chip status-chip-retrying';
  if (status === 'FAILED' || status === 'TIMEOUT' || status === 'INVALID_OUTPUT' || status === 'VALIDATION_FAILED') {
    return 'status-chip status-chip-failed';
  }
  return 'status-chip status-chip-neutral';
}

export default function LoggingPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AiGenerationLogDbRow[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ limit: '120' });
    void (async () => {
      try {
        const response = await fetch(`/api/ai-generation-logs?${params.toString()}`, { headers: { Accept: 'application/json' } });
        const payload = (await response.json()) as ApiResponse;
        setRows(payload.items ?? []);
        setHint(payload.hint ?? null);
      } catch {
        setHint('Unable to fetch logs.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = `${row.request_id} ${row.trace_id ?? ''} ${row.model ?? ''} ${row.error_message ?? ''}`.toLowerCase();
      const statusOk = status === 'ALL' || row.status === status;
      return statusOk && (!lower || haystack.includes(lower));
    });
  }, [rows, query, status]);

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[#38BDF8]/25 bg-[#081522]/90 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B8CA5]">Logging</p>
        <h1 className="mt-1 text-xl font-semibold">AI Generation Monitoring</h1>
        <p className="mt-1.5 text-sm text-[#6B8CA5]">Inspect failures, latency, token usage, model responses, and runtime traces.</p>
      </header>

      <div className="rounded-2xl border border-[#38BDF8]/20 bg-[#081522]/80 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search request id, trace id, model, error..."
            className="flex-1 rounded-xl border border-[#38BDF8]/30 bg-[#06111F] px-3 py-2 text-sm outline-none transition focus:border-[#00C8FF]"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-[#38BDF8]/30 bg-[#06111F] px-3 py-2 text-sm outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="INVALID_OUTPUT">Invalid output</option>
            <option value="TIMEOUT">Timeout</option>
            <option value="VALIDATION_FAILED">Validation failed</option>
            <option value="RETRYING">Retrying</option>
          </select>
        </div>
      </div>

      {hint ? <p className="rounded-lg border border-[#F59E0B]/45 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#FFD08A]">{hint}</p> : null}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-14 animate-pulse rounded-xl border border-[#38BDF8]/20 bg-[#081522]/75" />
          ))}
        </div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#38BDF8]/30 bg-[#06111F]/45 p-10 text-center text-sm text-[#6B8CA5]">
          No logs match the current filters.
        </div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[#38BDF8]/20 bg-[#081522]/70">
          <div className="grid grid-cols-12 border-b border-[#38BDF8]/20 bg-[#06111F]/80 px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-[#6B8CA5]">
            <span className="col-span-2">Status</span>
            <span className="col-span-3">Request</span>
            <span className="col-span-2">Model</span>
            <span className="col-span-2">Timing</span>
            <span className="col-span-2">Tokens</span>
            <span className="col-span-1 text-right">Details</span>
          </div>
          <div className="max-h-[66vh] overflow-y-auto">
            {filtered.map((row) => {
              const isOpen = expanded === row.id;
              return (
                <div key={row.id} className="border-b border-[#38BDF8]/15">
                  <div className="grid grid-cols-12 items-center px-3 py-2 text-xs transition hover:bg-[#06111F]/65">
                    <div className="col-span-2">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 ${statusColor(row.status)}`}>{row.status}</span>
                    </div>
                    <div className="col-span-3 truncate font-mono text-[#CBEFFF]">{row.request_id}</div>
                    <div className="col-span-2 truncate text-[#6B8CA5]">{row.model ?? '—'}</div>
                    <div className="col-span-2 text-[#6B8CA5]">{row.processing_time_ms ?? 0} ms</div>
                    <div className="col-span-2 text-[#6B8CA5]">
                      {(row.token_input ?? 0) + (row.token_output ?? 0)} total
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : row.id)}
                        className="table-action-btn"
                      >
                        {isOpen ? 'Hide' : 'View'}
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="grid gap-2 bg-[#06111F]/55 px-3 pb-3 text-xs text-[#6B8CA5] md:grid-cols-2">
                      <p>Timestamp: {new Date(row.created_at).toLocaleString()}</p>
                      <p className="truncate">Trace ID: {row.trace_id ?? '—'}</p>
                      <p>Provider: {row.provider ?? '—'}</p>
                      <p>Retry count: {row.retry_count ?? 0}</p>
                      <p className="md:col-span-2">Error: {row.error_message || 'None'}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
