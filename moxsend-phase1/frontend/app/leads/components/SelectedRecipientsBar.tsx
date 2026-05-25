'use client';

import type { RowResult } from '@/lib/lead-types';

function displayName(row: RowResult): string {
  const n = row.name || `${row.firstname} ${row.lastname}`.trim();
  return n || row.email || '—';
}

type Props = {
  leads: RowResult[];
  referenceIndex: number;
  onReferenceIndexChange: (index: number) => void;
  fileLabel: string;
};

export function SelectedRecipientsBar({
  leads,
  referenceIndex,
  onReferenceIndexChange,
  fileLabel,
}: Props) {
  const safeRef = leads.length === 0 ? 0 : Math.min(Math.max(0, referenceIndex), leads.length - 1);

  return (
    <section
      className="rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/90 to-white p-4 shadow-sm sm:p-5"
      aria-label="Selected recipients"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-700/90">Recipients</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            {leads.length} selected for this run
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            From <span className="font-medium text-slate-800">{fileLabel}</span>. One template for everyone; merge tags
            fill per recipient at send time. Click a card to pick the reference row for tone and context (others stay in
            the cohort summary).
          </p>
        </div>
      </div>

      <div className="mt-4 max-h-[220px] overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white/90 p-2 sm:max-h-[260px]">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((row, i) => {
            const isRef = i === safeRef;
            const initial = (displayName(row).trim().charAt(0) || '?').toUpperCase();
            return (
              <li key={`${row.email}-${i}`}>
                <button
                  type="button"
                  onClick={() => onReferenceIndexChange(i)}
                  className={`flex w-full min-w-0 items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    isRef
                      ? 'border-indigo-400 bg-indigo-50/90 ring-2 ring-indigo-400/60'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isRef ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                    aria-hidden
                  >
                    {initial}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{displayName(row)}</span>
                      {isRef ? (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Reference
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-slate-600">{row.email || '—'}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {[row.company, row.industry].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
