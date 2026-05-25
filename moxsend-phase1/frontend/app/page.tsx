'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Progress, RowResult } from '@/lib/lead-types';
import { saveLeadsSession } from '@/lib/leads-session';
import { ThemeToggle } from '@/components/ThemeToggle';

const POLL_MS = 450;
const PAGE_SIZE = 10;
const DB_PAGE_SIZE = 8;
const SAMPLE_CSV_HREF = '/sample-leads.csv';

type StoredLeadsApiResponse = {
  configured: boolean;
  count: number;
  leads: RowResult[];
  hint?: string;
};

function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw?.trim()) return '';
  return raw.replace(/\/$/, '');
}

type ApiErrorBody = { error: string; code?: string };

type ProcessingPayload = {
  status: 'processing';
  progress: Progress;
  data?: RowResult[];
};

type Summary = {
  total: number;
  success: number;
  failed: number;
};

type CompletedPayload = {
  status: 'completed';
  summary: Summary;
  data: RowResult[];
};

type FailedJobPayload = {
  status: 'failed';
  summary: Summary;
  data: RowResult[];
};

type ResultPayload = ProcessingPayload | CompletedPayload | FailedJobPayload;

function isTerminalPayload(r: ResultPayload): r is CompletedPayload | FailedJobPayload {
  return r.status === 'completed' || r.status === 'failed';
}

type JobLogKind = 'info' | 'success' | 'warn' | 'error';

type JobLogEntry = {
  id: string;
  at: number;
  kind: JobLogKind;
  title: string;
  detail?: string;
};

const MAX_JOB_LOGS = 100;

function formatLogTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(ts);
}

function logKindStyles(kind: JobLogKind): string {
  switch (kind) {
    case 'success':
      return 'bg-emerald-50 text-emerald-900 ring-emerald-200/80';
    case 'warn':
      return 'bg-amber-50 text-amber-950 ring-amber-200/80';
    case 'error':
      return 'bg-red-50 text-red-900 ring-red-200/80';
    default:
      return 'bg-slate-100 text-slate-800 ring-slate-200/80';
  }
}

async function readJson<T>(res: Response): Promise<T | ApiErrorBody> {
  try {
    return (await res.json()) as T | ApiErrorBody;
  } catch {
    return { error: 'Invalid response from server.', code: 'PARSE_ERROR' };
  }
}

function progressPercent(result: ProcessingPayload | null): number {
  if (!result || result.status !== 'processing') return 0;
  const p = result.progress;
  if (typeof p.percentage === 'number') return Math.min(100, Math.max(0, p.percentage));
  if (p.total > 0) return Math.min(100, Math.round((p.processed / p.total) * 100));
  return 0;
}

function TableSkeleton({ rows }: { rows: number }) {
  const n = Math.max(1, Math.min(rows, PAGE_SIZE));
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_auto] gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Email</span>
        <span>Name</span>
        <span>Company</span>
        <span>City</span>
        <span>Status</span>
        <span />
      </div>
      <ul className="divide-y divide-slate-100">
        {Array.from({ length: n }).map((_, i) => (
          <li
            key={i}
            className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_auto] items-center gap-3 px-4 py-3.5"
          >
            {Array.from({ length: 6 }).map((__, j) => (
              <div
                key={j}
                className="h-3.5 rounded-md bg-slate-100 animate-pulse"
                style={{ animationDelay: `${(i * 6 + j) * 50}ms` }}
              />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollSession, setPollSession] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [uploadingDb, setUploadingDb] = useState(false);
  const [uploadDbMessage, setUploadDbMessage] = useState<string | null>(null);
  const [modalRow, setModalRow] = useState<RowResult | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set());

  const [storedLeads, setStoredLeads] = useState<RowResult[]>([]);
  const [storedConfigured, setStoredConfigured] = useState<boolean | null>(null);
  const [storedHint, setStoredHint] = useState<string | null>(null);
  const [storedLoading, setStoredLoading] = useState(false);
  const [storedError, setStoredError] = useState<string | null>(null);
  const [dbSearch, setDbSearch] = useState('');
  const [dbPage, setDbPage] = useState(1);

  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const prevStatusRef = useRef<string | null>(null);
  const progressMilestoneRef = useRef<number>(-1);
  const terminalLoggedJobIdRef = useRef<string | null>(null);
  const lastErrorLoggedRef = useRef<string | null>(null);
  const modalTitleId = useId();

  const [jobLogs, setJobLogs] = useState<JobLogEntry[]>([]);

  const appendJobLog = useCallback((entry: Omit<JobLogEntry, 'id' | 'at'>) => {
    setJobLogs((prev) => {
      const row: JobLogEntry = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        at: Date.now(),
        ...entry,
      };
      return [row, ...prev].slice(0, MAX_JOB_LOGS);
    });
  }, []);

  const clearJobLogsDisplay = useCallback(() => setJobLogs([]), []);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchResult = useCallback(async (id: string) => {
    const base = getApiBase();
    const res = await fetch(`${base}/api/result/${id}`, { headers: { Accept: 'application/json' } });
    const body = await readJson<ResultPayload | ApiErrorBody>(res);
    if (!res.ok) {
      const err = body as ApiErrorBody;
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    return body as ResultPayload;
  }, []);

  const loadStoredLeads = useCallback(async () => {
    setStoredLoading(true);
    setStoredError(null);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/stored-leads?limit=200`, {
        headers: { Accept: 'application/json' },
      });
      const body = await readJson<StoredLeadsApiResponse | ApiErrorBody>(res);
      if (!res.ok) {
        const err = body as ApiErrorBody;
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const data = body as StoredLeadsApiResponse;
      setStoredConfigured(data.configured);
      setStoredHint(data.hint ?? null);
      const leads = data.leads ?? [];
      setStoredLeads(leads);
      setDbPage(1);
    } catch (e) {
      setStoredError(e instanceof Error ? e.message : 'Could not load saved leads.');
      setStoredLeads([]);
      setStoredConfigured(null);
    } finally {
      setStoredLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStoredLeads();
  }, [loadStoredLeads]);

  useEffect(() => {
    if (!jobId) {
      clearPoll();
      setPolling(false);
      return;
    }

    let cancelled = false;
    setPolling(true);

    const tick = async () => {
      try {
        const payload = await fetchResult(jobId);
        if (cancelled) return;
        setResult(payload);
        setError(null);
        if (isTerminalPayload(payload)) {
          clearPoll();
          setPolling(false);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Polling failed.');
        clearPoll();
        setPolling(false);
      }
    };

    void tick();
    pollRef.current = setInterval(() => void tick(), POLL_MS);

    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [jobId, pollSession, fetchResult, clearPoll]);

  useEffect(() => {
    progressMilestoneRef.current = -1;
    terminalLoggedJobIdRef.current = null;
    lastErrorLoggedRef.current = null;
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !result || result.status !== 'processing') return;
    const { processed, total } = result.progress;
    if (total <= 0) return;
    const pct = (processed / total) * 100;
    let milestone = -1;
    if (processed >= total) milestone = 100;
    else if (pct >= 75) milestone = 75;
    else if (pct >= 50) milestone = 50;
    else if (pct >= 25) milestone = 25;
    else if (processed > 0) milestone = 0;
    if (milestone <= progressMilestoneRef.current) return;
    progressMilestoneRef.current = milestone;
    const label = milestone === 0 ? 'Started' : `${milestone}%`;
    appendJobLog({
      kind: 'info',
      title: `Progress · ${label}`,
      detail: `${processed} of ${total} rows processed`,
    });
  }, [jobId, result, appendJobLog]);

  useEffect(() => {
    if (!jobId || !result || !isTerminalPayload(result)) return;
    if (terminalLoggedJobIdRef.current === jobId) return;
    terminalLoggedJobIdRef.current = jobId;
    const ok = result.status === 'completed';
    appendJobLog({
      kind: ok ? 'success' : 'warn',
      title: ok ? 'Completed' : 'Finished with issues',
      detail: `${result.summary.success} succeeded · ${result.summary.failed} failed`,
    });
  }, [jobId, result, appendJobLog]);

  useEffect(() => {
    if (!jobId || !error) return;
    if (lastErrorLoggedRef.current === error) return;
    lastErrorLoggedRef.current = error;
    appendJobLog({ kind: 'error', title: 'Error', detail: error });
  }, [jobId, error, appendJobLog]);

  const rowData = result?.data ?? [];
  const isProcessing = !!jobId && result?.status === 'processing';
  const isTerminal = result !== null && isTerminalPayload(result);

  useEffect(() => {
    if (!jobId || !result) return;
    const st = result.status;
    const wasProcessing = prevStatusRef.current === 'processing';
    const wasUnset = prevStatusRef.current === null;
    prevStatusRef.current = st;

    if (!isTerminalPayload(result)) return;

    if (wasProcessing || wasUnset) {
      const successIdx = result.data
        .map((row, i) => (row.status === 'success' ? i : -1))
        .filter((i) => i >= 0);
      setSelectedIndices(new Set(successIdx));
    }
  }, [result, jobId]);

  const totalPages = Math.max(1, Math.ceil(rowData.length / PAGE_SIZE));

  const filteredDbWithIndex = useMemo(() => {
    const q = dbSearch.trim().toLowerCase();
    return storedLeads
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        if (!q) return true;
        const hay = [row.name, row.email, row.company, row.city, row.industry].join(' ').toLowerCase();
        return hay.includes(q);
      });
  }, [storedLeads, dbSearch]);

  const dbTotalPages = Math.max(1, Math.ceil(filteredDbWithIndex.length / DB_PAGE_SIZE));

  useEffect(() => {
    setDbPage((p) => Math.min(Math.max(1, p), dbTotalPages));
  }, [dbTotalPages]);

  const dbPageSlice = useMemo(() => {
    const start = (dbPage - 1) * DB_PAGE_SIZE;
    return filteredDbWithIndex.slice(start, start + DB_PAGE_SIZE);
  }, [filteredDbWithIndex, dbPage]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!modalRow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalRow(null);
    };
    document.addEventListener('keydown', onKey);
    closeBtnRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [modalRow]);

  const paginatedSlice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rowData.slice(start, start + PAGE_SIZE);
  }, [rowData, page]);

  const pageIndices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return paginatedSlice.map((_, i) => start + i);
  }, [paginatedSlice, page]);

  const pageAllSelected =
    pageIndices.length > 0 && pageIndices.every((i) => selectedIndices.has(i));
  const pageSomeSelected = pageIndices.some((i) => selectedIndices.has(i));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = pageSomeSelected && !pageAllSelected;
  }, [pageAllSelected, pageSomeSelected]);

  const pickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const f = list[0];
    setFile(f);
    setError(null);
    setResult(null);
    setJobId(null);
    setUploadDbMessage(null);
    setJobLogs([]);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pickFiles(e.target.files);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    pickFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const upload = async () => {
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);
    setJobId(null);
    setUploadDbMessage(null);
    setSelectedIndices(new Set());
    setJobLogs([]);
    prevStatusRef.current = null;

    const fd = new FormData();
    fd.append('file', file);

    try {
      appendJobLog({
        kind: 'info',
        title: 'Upload started',
        detail: file.name,
      });
      const base = getApiBase();
      const res = await fetch(`${base}/api/upload`, { method: 'POST', body: fd });
      const body = await readJson<{ jobId: string; message: string } | ApiErrorBody>(res);

      if (!res.ok) {
        const err = body as ApiErrorBody;
        throw new Error(err.error || `Upload failed (${res.status})`);
      }

      const ok = body as { jobId: string };
      setJobId(ok.jobId);
      setPage(1);
      appendJobLog({
        kind: 'success',
        title: 'Upload accepted',
        detail: `Job ${ok.jobId.slice(0, 8)}…`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setJobId(null);
    setResult(null);
    setError(null);
    setPollSession(0);
    setModalRow(null);
    setPage(1);
    setSelectedIndices(new Set());
    setUploadDbMessage(null);
    setJobLogs([]);
    prevStatusRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
  };

  const startDisabled =
    uploading || !file || isProcessing || (jobId !== null && result === null);

  const retryFailedRows = async () => {
    if (!jobId) return;
    setRetrying(true);
    setError(null);
    prevStatusRef.current = 'processing';
    appendJobLog({
      kind: 'info',
      title: 'Retry requested',
      detail: 'Re-processing failed rows only',
    });
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/retry/${jobId}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const body = await readJson<{ message?: string } | ApiErrorBody>(res);
      if (!res.ok) {
        const err = body as ApiErrorBody;
        throw new Error(err.error || `Retry failed (${res.status})`);
      }
      setPollSession((s) => s + 1);
      progressMilestoneRef.current = -1;
      terminalLoggedJobIdRef.current = null;
      appendJobLog({ kind: 'info', title: 'Retry running', detail: 'Polling for updates…' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  };

  const toggleRow = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) {
        for (const i of pageIndices) next.delete(i);
      } else {
        for (const i of pageIndices) next.add(i);
      }
      return next;
    });
  };

  const goToLeadsFromDatabase = () => {
    if (storedLeads.length === 0) return;
    const indices = storedLeads.map((_, i) => i);
    saveLeadsSession({
      jobId: null,
      fileName: 'Saved leads · database',
      leads: storedLeads,
      selectedIndices: indices,
    });
    router.push('/leads');
  };

  const goToLeads = () => {
    if (!jobId || !isTerminal || rowData.length === 0) return;
    const indices = Array.from(selectedIndices);
    saveLeadsSession({
      jobId,
      fileName: file?.name ?? 'leads.csv',
      leads: rowData,
      selectedIndices: indices.length ? indices : rowData.map((_, i) => i),
    });
    router.push('/leads');
  };

  const uploadToDatabase = async () => {
    if (!jobId || !isTerminal) return;
    const indices = Array.from(selectedIndices);
    if (!indices.length) {
      setError('Select at least one row to upload.');
      return;
    }

    setUploadingDb(true);
    setError(null);
    setUploadDbMessage(null);

    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/result/${jobId}/upload-to-database`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ indices }),
      });
      const body = await readJson<{ message?: string; inserted?: number } | ApiErrorBody>(res);
      if (!res.ok) {
        const err = body as ApiErrorBody;
        throw new Error(err.error || `Upload failed (${res.status})`);
      }
      const ok = body as { message?: string; inserted?: number };
      setUploadDbMessage(
        ok.message ?? `Saved ${ok.inserted ?? indices.length} row(s) to Supabase.`,
      );
      appendJobLog({
        kind: 'success',
        title: 'Saved to database',
        detail: ok.message ?? `${ok.inserted ?? indices.length} row(s) · Supabase`,
      });
      void loadStoredLeads();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload to database failed.');
    } finally {
      setUploadingDb(false);
    }
  };

  const mandatoryHeaders =
    'Required columns: email, firstname, lastname, phone, company, city, country, industry. All other supported columns are optional.';

  const showProgressPanel = !!jobId && (result?.status === 'processing' || result === null);
  const showSkeleton = !!jobId && isProcessing && rowData.length === 0;
  const showResultsTable = !!jobId && (rowData.length > 0 || isTerminal);

  const processingPayload = result?.status === 'processing' ? result : null;
  const progressBarPct = processingPayload ? progressPercent(processingPayload) : 0;
  const progressBarDeterminate =
    !!processingPayload &&
    (processingPayload.progress.total > 0 ||
      typeof processingPayload.progress.percentage === 'number');
  const progressBarIndeterminate = showProgressPanel && !progressBarDeterminate;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mb-10 border-b border-slate-200/90 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Imports</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Lead file processing
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                Upload a UTF-8 CSV with the standard lead columns. {mandatoryHeaders} Row-level issues
                are surfaced after processing so valid rows still complete.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {error ? (
          <div
            className="mb-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {uploadDbMessage ? (
          <div
            className="mb-8 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm"
            role="status"
          >
            {uploadDbMessage}
          </div>
        ) : null}

        <section className="mt-10" aria-labelledby="stored-leads-heading">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-violet-50/50 shadow-md shadow-slate-200/40">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl"
              aria-hidden
            />
            <div className="relative rounded-3xl bg-white/90 backdrop-blur-[2px]">
              <div className="border-b border-slate-100/90 bg-gradient-to-r from-slate-50/95 via-white to-violet-50/40 px-5 py-5 sm:px-8 sm:py-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30 ring-4 ring-white">
                      <svg
                        className="h-7 w-7"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600/90">
                        Workspace
                      </p>
                      <h2
                        id="stored-leads-heading"
                        className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl"
                      >
                        Leads in your database
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                        Rows you have already saved to Supabase appear here. Continue to filters and AI personalize
                        without uploading again — you can narrow the list on the next screen.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:pt-1">
                    <button
                      type="button"
                      onClick={() => void loadStoredLeads()}
                      disabled={storedLoading}
                      className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <svg
                        className={`h-4 w-4 ${storedLoading ? 'animate-spin' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                        />
                      </svg>
                      {storedLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-5 py-6 sm:px-8 sm:py-7">
                {storedError ? (
                  <div
                    className="mb-5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900"
                    role="alert"
                  >
                    {storedError}
                  </div>
                ) : null}

                {storedConfigured === false ? (
                  <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/40 px-5 py-4 text-sm text-amber-950 shadow-sm">
                    <p className="font-medium text-amber-950">Connect Supabase to see saved leads</p>
                    <p className="mt-2 leading-relaxed text-amber-900/90">
                      {storedHint ||
                        'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your API environment, then upload rows from a completed job.'}
                    </p>
                  </div>
                ) : null}

                {storedLoading && storedLeads.length === 0 ? (
                  <div className="space-y-3 py-4">
                    <div className="h-4 max-w-xs animate-pulse rounded-lg bg-slate-100" />
                    <TableSkeleton rows={5} />
                  </div>
                ) : null}

                {storedConfigured && !storedLoading && storedLeads.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                    <p className="text-sm font-medium text-slate-800">No leads in the database yet</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                      Process a CSV below, then use <span className="font-medium text-slate-800">Upload to database</span>{' '}
                      on completed jobs. They will show up here automatically.
                    </p>
                  </div>
                ) : null}

                {storedLeads.length > 0 ? (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <label className="relative block w-full max-w-md">
                        <span className="sr-only">Search saved leads</span>
                        <svg
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                          />
                        </svg>
                        <input
                          type="search"
                          value={dbSearch}
                          onChange={(e) => {
                            setDbSearch(e.target.value);
                            setDbPage(1);
                          }}
                          placeholder="Search name, email, company…"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none ring-violet-500/20 transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                          <span className="tabular-nums text-slate-900">{storedLeads.length}</span> saved
                        </span>
                        {filteredDbWithIndex.length !== storedLeads.length ? (
                          <span className="text-slate-500">
                            <span className="tabular-nums font-medium text-slate-800">
                              {filteredDbWithIndex.length}
                            </span>{' '}
                            match filter
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
                      <div className="overflow-x-auto">
                        <table className="min-w-[640px] w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/95">
                              <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Lead
                              </th>
                              <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Company
                              </th>
                              <th className="hidden px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">
                                Location
                              </th>
                              <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dbPageSlice.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                                  No leads match your search.
                                </td>
                              </tr>
                            ) : (
                              dbPageSlice.map(({ row, originalIndex }) => {
                                const initials = (row.name || row.email || '?')
                                  .split(/\s+/)
                                  .map((w) => w[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase();
                                return (
                                  <tr
                                    key={`${row.dbId ?? row.email}-${originalIndex}`}
                                    className="group transition-colors hover:bg-violet-50/40"
                                  >
                                    <td className="px-3 py-3.5 align-middle">
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/80 text-xs font-bold text-slate-700 ring-1 ring-slate-200/80">
                                          {initials}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate font-medium text-slate-900">
                                            {row.name || '—'}
                                          </p>
                                          <p className="truncate font-mono text-xs text-slate-500">{row.email}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="max-w-[200px] px-3 py-3.5 align-middle">
                                      <p className="truncate font-medium text-slate-800">{row.company || '—'}</p>
                                      {row.industry ? (
                                        <p className="truncate text-xs text-slate-500">{row.industry}</p>
                                      ) : null}
                                    </td>
                                    <td className="hidden max-w-[140px] px-3 py-3.5 align-middle sm:table-cell">
                                      <p className="truncate text-slate-700">
                                        {[row.city, row.country].filter(Boolean).join(', ') || '—'}
                                      </p>
                                    </td>
                                    <td className="px-3 py-3.5 align-middle">
                                      {row.status === 'success' ? (
                                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/70">
                                          Ready
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 ring-1 ring-red-200/70">
                                          Failed
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {filteredDbWithIndex.length > DB_PAGE_SIZE ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                        <p className="text-slate-500">
                          Page{' '}
                          <span className="font-semibold tabular-nums text-slate-900">{dbPage}</span> /{' '}
                          <span className="tabular-nums">{dbTotalPages}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={dbPage <= 1}
                            onClick={() => setDbPage((p) => Math.max(1, p - 1))}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:opacity-40"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            disabled={dbPage >= dbTotalPages}
                            onClick={() => setDbPage((p) => Math.min(dbTotalPages, p + 1))}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50/90 via-white to-violet-50/30 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <p className="text-sm text-slate-600">
                        Continue with all <span className="font-semibold text-slate-900">{storedLeads.length}</span>{' '}
                        saved lead(s). Refine who is included using filters and row selection on the next screen.
                      </p>
                      <button
                        type="button"
                        onClick={goToLeadsFromDatabase}
                        disabled={storedLeads.length === 0}
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-violet-600 to-indigo-700 px-6 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:from-violet-500 hover:to-indigo-600 disabled:pointer-events-none disabled:opacity-45"
                      >
                        Next — filter &amp; personalize
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 grid gap-4 md:grid-cols-2 md:items-stretch lg:grid-cols-12 lg:gap-5">
          <section className="md:col-span-1 lg:col-span-7" aria-labelledby="upload-heading">
            <div className="h-full rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="upload-heading" className="text-base font-semibold text-slate-900">
                    Upload file
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">Drag in a file or browse from disk.</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    Max 100 rows
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    CSV only
                  </span>
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`mt-3 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-6 text-center transition-all duration-200 sm:min-h-[108px] sm:flex-row sm:gap-4 sm:py-4 ${
                  dragActive
                    ? 'border-violet-400 bg-violet-50/60 shadow-inner'
                    : 'border-slate-300 bg-slate-50/40 hover:border-slate-400 hover:bg-slate-50/80'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={onInputChange}
                />
                <div className="rounded-full bg-white p-2 shadow-sm ring-1 ring-slate-200/90">
                  <svg
                    className="h-5 w-5 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                </div>
                <div className="min-w-0 sm:text-left">
                  <p className="mt-2 text-sm font-medium text-slate-800 sm:mt-0">Drop CSV here</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">or click to choose · UTF-8</p>
                  {file ? (
                    <p className="mt-2 max-w-full truncate rounded-md bg-white px-2 py-1 text-[11px] font-mono text-slate-700 ring-1 ring-slate-200/90 sm:mt-1.5">
                      {file.name}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-slate-400">No file chosen</p>
                  )}
                </div>
              </div>

              {!jobId ? (
                <p className="mt-3 text-center text-xs text-slate-500">Upload a CSV to begin.</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={upload}
                  disabled={startDisabled}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 px-4 text-xs font-medium text-white shadow-md shadow-slate-900/15 transition hover:from-slate-700 hover:to-slate-800 hover:shadow-lg disabled:pointer-events-none disabled:opacity-45 sm:text-sm"
                >
                  {uploading ? 'Uploading…' : isProcessing ? 'Processing…' : 'Start processing'}
                </button>
                <a
                  href={SAMPLE_CSV_HREF}
                  download="sample-leads.csv"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:text-sm"
                >
                  Download sample CSV
                </a>
                <button
                  type="button"
                  onClick={reset}
                  disabled={uploading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 sm:text-sm"
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

          <aside className="md:col-span-1 lg:col-span-5" aria-labelledby="status-heading">
            <div className="flex h-full flex-col rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-sm ring-1 ring-slate-100/80 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="status-heading" className="text-base font-semibold text-slate-900">
                    Job status
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">Live progress for the current import.</p>
                </div>
              </div>

              {!jobId ? (
                <div className="mt-4 flex flex-1 flex-col justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-6 text-center">
                  <p className="text-xs leading-relaxed text-slate-500">
                    Start processing a CSV to see row counts and completion here.
                  </p>
                </div>
              ) : (
                <div className="mt-4 flex flex-1 flex-col">
                  <p className="break-all font-mono text-[10px] leading-relaxed text-slate-400" title={jobId ?? undefined}>
                    {jobId}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {result?.status === 'processing' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200/80">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-40" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                        </span>
                        Processing
                      </span>
                    ) : null}
                    {isTerminal && result.status === 'completed' ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900 ring-1 ring-emerald-200/80">
                        Completed
                      </span>
                    ) : null}
                    {isTerminal && result.status === 'failed' ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-900 ring-1 ring-red-200/80">
                        Job error
                      </span>
                    ) : null}
                    {polling ? (
                      <span className="text-[11px] text-slate-400">{result ? 'Live updates' : 'Connecting…'}</span>
                    ) : null}
                  </div>

                  {showProgressPanel ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex justify-between gap-2 text-[11px] font-medium text-slate-600">
                        <span>Progress</span>
                        <span className="tabular-nums text-right">
                          {result && result.status === 'processing' ? (
                            <>
                              {result.progress.processed} / {result.progress.total} rows · {progressBarPct}%
                            </>
                          ) : (
                            <span className="text-slate-400">Starting…</span>
                          )}
                        </span>
                      </div>
                      <div
                        className="relative h-2 overflow-hidden rounded-full bg-slate-200/80 ring-1 ring-slate-200/90"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Import progress"
                        {...(progressBarIndeterminate
                          ? { 'aria-valuetext': 'In progress', 'aria-busy': true }
                          : { 'aria-valuenow': progressBarPct })}
                      >
                        {progressBarIndeterminate ? (
                          <div
                            className="absolute inset-y-0 w-[42%] rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 shadow-sm"
                            style={{ animation: 'moxsend-indeterminate 1.15s linear infinite' }}
                          />
                        ) : (
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-[width] duration-300 ease-out"
                            style={{ width: `${progressBarPct}%` }}
                          />
                        )}
                      </div>
                      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(
                          [
                            ['Total', result?.status === 'processing' ? result.progress.total : '—'],
                            ['Processed', result?.status === 'processing' ? result.progress.processed : '—'],
                            ['Success', result?.status === 'processing' ? result.progress.success : '—'],
                            ['Failed', result?.status === 'processing' ? result.progress.failed : '—'],
                          ] as const
                        ).map(([label, val]) => (
                          <div key={label} className="rounded-md border border-slate-100/90 bg-white/90 px-2 py-1.5 shadow-sm">
                            <dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{val}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}

                  {isTerminal ? (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Final counts</p>
                      <dl className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-slate-100 bg-white px-2 py-2 text-center shadow-sm">
                          <dt className="text-[9px] font-semibold uppercase text-slate-500">Total</dt>
                          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{result.summary.total}</dd>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-2 text-center shadow-sm">
                          <dt className="text-[9px] font-semibold uppercase text-emerald-800/90">Success</dt>
                          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-900">{result.summary.success}</dd>
                        </div>
                        <div className="rounded-lg border border-red-100 bg-red-50/60 px-2 py-2 text-center shadow-sm">
                          <dt className="text-[9px] font-semibold uppercase text-red-800/90">Failed</dt>
                          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-red-900">{result.summary.failed}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </aside>
        </div>

        <section
          className="mt-4 flex max-h-[min(480px,60vh)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80 lg:mt-5"
          aria-labelledby="job-log-heading"
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2.5 sm:px-4">
            <div className="min-w-0">
              <h2 id="job-log-heading" className="text-sm font-semibold text-slate-900">
                Activity log
              </h2>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Newest first · upload, progress milestones, completion, retries, and database saves
                {jobId ? (
                  <>
                    {' '}
                    <span className="font-mono text-slate-400">·</span>{' '}
                    <span className="break-all font-mono text-[10px] text-slate-500" title={jobId}>
                      {jobId.slice(0, 8)}…
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={clearJobLogsDisplay}
              disabled={jobLogs.length === 0}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {jobLogs.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-600">No events yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
                  Choose a CSV and click <span className="font-medium text-slate-500">Start processing</span>. Lines will
                  appear here as the job is accepted, progresses, and finishes.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-[11px] sm:text-xs">
                <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-white/95 backdrop-blur-sm">
                  <tr>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4"
                    >
                      Time
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4"
                    >
                      Event
                    </th>
                    <th
                      scope="col"
                      className="min-w-[8rem] px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-500 sm:px-4"
                    >
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobLogs.map((row) => (
                    <tr key={row.id} className="bg-white transition-colors hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-slate-500 sm:px-4">
                        {formatLogTime(row.at)}
                      </td>
                      <td className="px-3 py-2.5 sm:px-4">
                        <span
                          className={`inline-flex max-w-[11rem] items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight ring-1 sm:max-w-none sm:text-[11px] ${logKindStyles(row.kind)}`}
                        >
                          {row.title}
                        </span>
                      </td>
                      <td className="break-words px-3 py-2.5 text-slate-600 sm:px-4">{row.detail ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {jobId ? (
          <section className="mt-10" aria-labelledby="results-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="results-heading" className="text-lg font-semibold text-slate-900">
                  Row results
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {isProcessing
                    ? 'Showing rows as they finish (first page updates live).'
                    : 'Final outcomes for this job.'}
                </p>
              </div>
              {showResultsTable && rowData.length > PAGE_SIZE ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="tabular-nums">
                    Page {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>

            {showSkeleton ? <TableSkeleton rows={Math.min(10, result?.progress?.total ?? 5)} /> : null}

            {showResultsTable && !showSkeleton ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-[960px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/95">
                        {isTerminal ? (
                          <th className="w-10 px-3 py-3">
                            <input
                              ref={selectAllRef}
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={pageAllSelected}
                              onChange={togglePageSelection}
                              aria-label="Select all rows on this page"
                            />
                          </th>
                        ) : (
                          <th className="w-10 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            #
                          </th>
                        )}
                        {[
                          'Email',
                          'Name',
                          'Company',
                          'City',
                          'Industry',
                          'Status',
                          '',
                        ].map((h) => (
                          <th
                            key={h || 'actions'}
                            className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedSlice.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                            No rows in this job.
                          </td>
                        </tr>
                      ) : (
                        paginatedSlice.map((row, j) => {
                          const globalIndex = (page - 1) * PAGE_SIZE + j;
                          return (
                            <tr
                              key={`${row.email}-${row.company}-${globalIndex}`}
                              className="transition-colors hover:bg-slate-50/90"
                            >
                              <td className="px-3 py-3.5">
                                {isTerminal ? (
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300"
                                    checked={selectedIndices.has(globalIndex)}
                                    onChange={() => toggleRow(globalIndex)}
                                    aria-label={`Select row ${globalIndex + 1}`}
                                  />
                                ) : (
                                  <span className="text-xs tabular-nums text-slate-400">
                                    {globalIndex + 1}
                                  </span>
                                )}
                              </td>
                              <td className="max-w-[180px] truncate px-4 py-3.5 font-mono text-xs text-slate-800">
                                {row.email || '—'}
                              </td>
                              <td className="max-w-[140px] truncate px-4 py-3.5 font-medium text-slate-900">
                                {row.name || '—'}
                              </td>
                              <td className="max-w-[160px] truncate px-4 py-3.5 text-slate-700">
                                {row.company || '—'}
                              </td>
                              <td className="max-w-[120px] truncate px-4 py-3.5 text-slate-600">
                                {row.city || '—'}
                              </td>
                              <td className="px-4 py-3.5">
                                {row.industry ? (
                                  <span className="inline-block max-w-[140px] truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                    {row.industry}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5">
                                {row.status === 'success' ? (
                                  <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/70">
                                    Success
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 ring-1 ring-red-200/70">
                                    <span
                                      className="h-1.5 w-1.5 rounded-full bg-red-500"
                                      title={row.error}
                                    />
                                    Failed
                                  </span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3.5">
                                {row.status === 'success' && row.output ? (
                                  <button
                                    type="button"
                                    onClick={() => setModalRow(row)}
                                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                                  >
                                    View output
                                  </button>
                                ) : row.error ? (
                                  <span
                                    className="inline-block max-w-[200px] cursor-help truncate border-b border-dotted border-red-300 text-xs text-red-700"
                                    title={row.error}
                                  >
                                    {row.error}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {isTerminal ? (
              <div className="mt-6 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={goToLeads}
                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-indigo-600 to-indigo-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-indigo-500 hover:to-indigo-600"
                  >
                    Next — filter &amp; personalize
                  </button>
                  <a
                    href={`${getApiBase()}/api/result/${jobId}/download`}
                    download
                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-slate-700 hover:to-slate-800"
                  >
                    Download CSV
                  </a>
                  <button
  type="button"
  onClick={uploadToDatabase}
  disabled={uploadingDb || selectedIndices.size === 0}
  className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:pointer-events-none disabled:opacity-45"
>
  {uploadingDb ? 'Uploading…' : 'Upload to database'}
</button>
                  <button
                    type="button"
                    onClick={retryFailedRows}
                    disabled={retrying || result.summary.failed === 0}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-45"
                  >
                    {retrying ? 'Retrying…' : 'Retry failed rows'}
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {selectedIndices.size} row(s) selected. They are upserted into the{' '}
                  <span className="font-mono text-slate-700">leads</span> table (see{' '}
                  <span className="font-mono text-slate-700">supabase/migrations</span>).
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

      
      </div>

      {modalRow?.output ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="presentation"
          onClick={() => setModalRow(null)}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id={modalTitleId} className="text-base font-semibold text-slate-900">
                  Generated output
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {modalRow.name} · {modalRow.company}
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setModalRow(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Opening line
                </p>
                <p className="mt-1 leading-relaxed text-slate-800">{modalRow.output.openingLine}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Email</p>
                <p className="mt-1 font-mono text-sm text-slate-800">{modalRow.output.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Subject lines
                </p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-slate-800">
                  <li>{modalRow.output.subjects[0]}</li>
                  <li>{modalRow.output.subjects[1]}</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
