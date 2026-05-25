'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RowResult } from '@/lib/lead-types';
import { loadLeadsSession, saveLeadsSession } from '@/lib/leads-session';
import { ThemeToggle } from '@/components/ThemeToggle';
import { buildFilterOptions, FilterBar, type SendCountFilter, type SortKey } from './components/FilterBar';
import { LeadsDataTable, type RowWithIndex } from './components/LeadsDataTable';

const PAGE_SIZE = 10;

function dedupeLeadsWithIndexMap(leads: RowResult[]) {
  const deduped: RowResult[] = [];
  const keyToNewIndex = new Map<string, number>();
  const oldToNewIndex = new Map<number, number>();

  for (let i = 0; i < leads.length; i += 1) {
    const row = leads[i];
    const key = [
      row.dbId || '',
      row.email?.trim().toLowerCase() || '',
      row.company?.trim().toLowerCase() || '',
      row.name?.trim().toLowerCase() || '',
    ].join('|');

    const existing = keyToNewIndex.get(key);
    if (existing !== undefined) {
      oldToNewIndex.set(i, existing);
      continue;
    }

    const nextIndex = deduped.length;
    keyToNewIndex.set(key, nextIndex);
    oldToNewIndex.set(i, nextIndex);
    deduped.push(row);
  }

  return { deduped, oldToNewIndex };
}

function matchesTags(row: RowResult, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const rowTags = (row.tags || '')
    .split(/[,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return selected.every((t) => rowTags.includes(t.toLowerCase()));
}

function sendCountMatch(row: RowResult, f: SendCountFilter): boolean {
  if (f === 'any') return true;
  const n = row.output ? 1 : 0;
  if (f === '0') return n === 0;
  return n >= 1;
}

export default function LeadsPage() {
  const router = useRouter();
  const mainId = useId();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [ready, setReady] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [leads, setLeads] = useState<RowResult[]>([]);

  const [search, setSearch] = useState('');
  const [companySize, setCompanySize] = useState('__all__');
  const [country, setCountry] = useState('__all__');
  const [industry, setIndustry] = useState('__all__');
  const [designation, setDesignation] = useState('__all__');
  const [leadStatus, setLeadStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [leadType, setLeadType] = useState('__all__');
  const [tagsSelected, setTagsSelected] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [sendCount, setSendCount] = useState<SendCountFilter>('any');

  const [tablePage, setTablePage] = useState(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const s = loadLeadsSession();
    if (!s?.leads?.length) {
      router.replace('/');
      return;
    }
    const { deduped, oldToNewIndex } = dedupeLeadsWithIndexMap(s.leads);
    setJobId(s.jobId);
    setFileName(s.fileName || 'leads.csv');
    setLeads(deduped);

    const remappedStored = (s.selectedIndices ?? [])
      .filter((i) => i >= 0 && i < s.leads.length)
      .map((i) => oldToNewIndex.get(i))
      .filter((i): i is number => typeof i === 'number');

    const stored = [...new Set(remappedStored)];
    if (stored.length > 0) {
      const next = new Set(stored);
      setSelectedIndices(next);
    } else {
      const successIdx = deduped
        .map((row, i) => (row.status === 'success' ? i : -1))
        .filter((i) => i >= 0);
      const next = new Set(successIdx.length ? successIdx : deduped.map((_, i) => i));
      setSelectedIndices(next);
    }
    setReady(true);
  }, [router]);

  const optionLists = useMemo(() => buildFilterOptions(leads), [leads]);

  const filteredWithIndex = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows: RowWithIndex[] = leads
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        if (q) {
          const hay = [row.name, row.email, row.company, row.designation]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (companySize !== '__all__' && row.company_size !== companySize) return false;
        if (country !== '__all__' && row.country !== country) return false;
        if (industry !== '__all__' && row.industry !== industry) return false;
        if (designation !== '__all__' && row.designation !== designation) return false;
        if (leadStatus !== 'all' && row.status !== leadStatus) return false;
        if (leadType !== '__all__' && row.lead_type !== leadType) return false;
        if (!matchesTags(row, tagsSelected)) return false;
        if (!sendCountMatch(row, sendCount)) return false;
        return true;
      });

    rows.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.originalIndex - a.originalIndex;
        case 'oldest':
          return a.originalIndex - b.originalIndex;
        case 'name':
          return (a.row.name || '').localeCompare(b.row.name || '');
        case 'company':
          return (a.row.company || '').localeCompare(b.row.company || '');
        case 'status':
          if (a.row.status === b.row.status) return 0;
          return a.row.status === 'success' ? -1 : 1;
        default:
          return 0;
      }
    });

    return rows;
  }, [
    leads,
    search,
    companySize,
    country,
    industry,
    designation,
    leadStatus,
    leadType,
    tagsSelected,
    sendCount,
    sortBy,
  ]);

  const totalTablePages = Math.max(1, Math.ceil(filteredWithIndex.length / PAGE_SIZE));

  useEffect(() => {
    setTablePage((p) => Math.min(Math.max(1, p), totalTablePages));
  }, [totalTablePages]);

  const pageSlice = useMemo(() => {
    const start = (tablePage - 1) * PAGE_SIZE;
    return filteredWithIndex.slice(start, start + PAGE_SIZE);
  }, [filteredWithIndex, tablePage]);

  const pageOriginalIndices = useMemo(() => pageSlice.map((x) => x.originalIndex), [pageSlice]);

  const pageAllSelected =
    pageOriginalIndices.length > 0 && pageOriginalIndices.every((i) => selectedIndices.has(i));
  const pageSomeSelected = pageOriginalIndices.some((i) => selectedIndices.has(i));

  const allFilteredSelected =
    filteredWithIndex.length > 0 &&
    filteredWithIndex.every(({ originalIndex }) => selectedIndices.has(originalIndex));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = pageSomeSelected && !pageAllSelected;
  }, [pageAllSelected, pageSomeSelected]);

  const toggleRow = useCallback((originalIndex: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(originalIndex)) next.delete(originalIndex);
      else next.add(originalIndex);
      return next;
    });
  }, []);

  const togglePageSelection = useCallback(() => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) {
        for (const i of pageOriginalIndices) next.delete(i);
      } else {
        for (const i of pageOriginalIndices) next.add(i);
      }
      return next;
    });
  }, [pageAllSelected, pageOriginalIndices]);

  const toggleAllFilteredSelection = useCallback(() => {
    setSelectedIndices((prev) => {
      const allOn =
        filteredWithIndex.length > 0 &&
        filteredWithIndex.every(({ originalIndex }) => prev.has(originalIndex));
      if (allOn) {
        const next = new Set(prev);
        for (const { originalIndex } of filteredWithIndex) {
          next.delete(originalIndex);
        }
        return next;
      }
      const next = new Set(prev);
      for (const { originalIndex } of filteredWithIndex) {
        next.add(originalIndex);
      }
      return next;
    });
  }, [filteredWithIndex]);

  const selectedCount = selectedIndices.size;
  const successCount = filteredWithIndex.filter(({ row }) => row.status === 'success').length;
  const failedCount = filteredWithIndex.length - successCount;

  const persistSession = useCallback(() => {
    const indices = Array.from(selectedIndices);
    saveLeadsSession({
      jobId,
      fileName,
      leads,
      selectedIndices: indices,
    });
  }, [jobId, fileName, leads, selectedIndices]);

  useEffect(() => {
    if (!ready) return;
    persistSession();
  }, [ready, persistSession]);

  const goToPersonalize = () => {
    if (selectedCount === 0) return;
    const indices = Array.from(selectedIndices).sort((a, b) => a - b);
    saveLeadsSession({
      jobId,
      fileName,
      leads,
      selectedIndices: indices,
    });
    router.push('/leads/personalize');
  };

  if (!ready) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id={mainId} className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 border-b border-slate-200/90 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Workflow</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Leads</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Filter and select leads, then continue to AI personalize. Only checked rows move forward.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back
              </Link>
            </div>
          </div>
        </header>

        <section className="space-y-6" aria-label="Lead filters and table">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Total Loaded</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{leads.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">After Filters</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{filteredWithIndex.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/60 p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-800">Success Rows</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">{successCount}</p>
            </div>
            <div className="rounded-2xl border border-red-200/90 bg-red-50/60 p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.14em] text-red-800">Failed Rows</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-900">{failedCount}</p>
            </div>
          </div>

          <FilterBar
            fileLabel={fileName}
            totalLeads={leads.length}
            search={search}
            onSearchChange={setSearch}
            companySize={companySize}
            onCompanySizeChange={setCompanySize}
            country={country}
            onCountryChange={setCountry}
            industry={industry}
            onIndustryChange={setIndustry}
            designation={designation}
            onDesignationChange={setDesignation}
            leadStatus={leadStatus}
            onLeadStatusChange={setLeadStatus}
            leadType={leadType}
            onLeadTypeChange={setLeadType}
            tagsSelected={tagsSelected}
            onTagsChange={setTagsSelected}
            sortBy={sortBy}
            onSortChange={setSortBy}
            sendCount={sendCount}
            onSendCountChange={setSendCount}
            optionLists={optionLists}
          />

          <LeadsDataTable
            rows={pageSlice}
            page={tablePage}
            totalPages={totalTablePages}
            onPageChange={setTablePage}
            selectedIndices={selectedIndices}
            onToggleRow={toggleRow}
            visibleCount={pageSlice.length}
            pageAllSelected={pageAllSelected}
            pageSomeSelected={pageSomeSelected}
            onTogglePage={togglePageSelection}
            selectAllRef={selectAllRef}
            filteredTotal={filteredWithIndex.length}
            allFilteredSelected={allFilteredSelected}
            onToggleAllFiltered={toggleAllFilteredSelection}
          />

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#38BDF8]/20 bg-[#081522]/95 p-4 shadow-[0_8px_24px_rgba(2,8,18,0.3)] backdrop-blur-sm sm:p-5">
            <p className="text-sm text-[#CBEFFF]">
              <span className="font-semibold text-white">{selectedCount}</span> lead(s) selected for next step.{' '}
              <span className="text-[#6B8CA5]">|</span>{' '}
              <span className="tabular-nums font-medium text-white">{filteredWithIndex.length}</span> shown after
              filters.
            </p>
            <button
              type="button"
              onClick={goToPersonalize}
              disabled={selectedCount === 0}
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[#00C8FF]/70 bg-[#00C8FF]/20 px-5 text-sm font-medium text-[#D8F6FF] transition hover:bg-[#00C8FF]/30 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next — AI personalize
            </button>
          </div>
        </section>

        <footer className="mt-14 border-t border-slate-200/80 pt-6 text-center text-xs text-slate-400">
          {jobId ? <span className="font-mono">Job {jobId}</span> : null}
        </footer>
      </div>
    </main>
  );
}
