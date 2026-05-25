'use client';

import type { RefObject } from 'react';
import type { RowResult } from '@/lib/lead-types';

export type RowWithIndex = { row: RowResult; originalIndex: number };

type Props = {
  rows: RowWithIndex[];
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  selectedIndices: Set<number>;
  onToggleRow: (originalIndex: number) => void;
  visibleCount: number;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  onTogglePage: () => void;
  selectAllRef: RefObject<HTMLInputElement | null>;
  filteredTotal: number;
  allFilteredSelected: boolean;
  onToggleAllFiltered: () => void;
};

const toolbarBtn =
  'inline-flex items-center justify-center rounded-xl border px-3.5 py-2 text-sm font-semibold tracking-tight shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/70 disabled:pointer-events-none disabled:opacity-40 border-slate-200/90 bg-white text-slate-800 hover:bg-slate-50 dark:border-[rgba(56,189,248,0.22)] dark:bg-[#0a1628] dark:text-[#d8f6ff] dark:shadow-[inset_0_1px_0_rgba(56,189,248,0.07)] dark:hover:bg-[#0d1f38]';

const toolbarSelect =
  'inline-flex cursor-pointer select-none items-center gap-2.5 rounded-xl border px-3.5 py-2 text-sm font-semibold tracking-tight shadow-sm transition hover:brightness-[1.02] dark:hover:brightness-110 border-slate-200/90 bg-slate-50 text-slate-800 dark:border-[rgba(56,189,248,0.22)] dark:bg-[#0a1628] dark:text-[#d8f6ff] dark:shadow-[inset_0_1px_0_rgba(56,189,248,0.07)] has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-40';

const toolbarCheckbox =
  'h-4 w-4 shrink-0 rounded border-slate-400 text-sky-600 focus:ring-2 focus:ring-sky-400/40 focus:ring-offset-0 dark:border-[rgba(56,189,248,0.45)] dark:bg-[#06111f] dark:text-sky-400';

export function LeadsDataTable({
  rows,
  page,
  totalPages,
  onPageChange,
  selectedIndices,
  onToggleRow,
  visibleCount,
  pageAllSelected,
  pageSomeSelected,
  onTogglePage,
  selectAllRef,
  filteredTotal,
  allFilteredSelected,
  onToggleAllFiltered,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/40 px-4 py-3 dark:border-[var(--border)] dark:bg-[#060d18]/90 sm:px-5">
        <p className="text-sm font-semibold text-slate-800 dark:text-[var(--text)]">Leads</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {totalPages > 1 ? (
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className={toolbarBtn}
            >
              Previous
            </button>
          ) : null}
          <label className={toolbarSelect}>
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={pageAllSelected}
              onChange={onTogglePage}
              disabled={visibleCount === 0}
              className={toolbarCheckbox}
            />
            <span className="flex flex-wrap items-baseline gap-x-1">
              <span>Select Page</span>
              <span className="tabular-nums text-slate-500 dark:text-[var(--text-muted)]">({visibleCount})</span>
              {pageSomeSelected && !pageAllSelected ? (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">· partial</span>
              ) : null}
            </span>
          </label>
          <button
            type="button"
            disabled={filteredTotal === 0}
            onClick={onToggleAllFiltered}
            aria-pressed={allFilteredSelected}
            title={
              allFilteredSelected
                ? 'Remove all filtered leads from selection'
                : 'Select every lead that matches current filters'
            }
            className={`${toolbarBtn} ${
              allFilteredSelected
                ? 'border-sky-500/35 bg-sky-50 text-sky-900 dark:border-[rgba(0,200,255,0.35)] dark:bg-[#00c8ff]/12 dark:text-[#d8f6ff]'
                : ''
            }`}
          >
            <span className="tabular-nums">
              {allFilteredSelected ? 'Deselect all' : 'Select all'}{' '}
              <span className="font-semibold opacity-90">({filteredTotal})</span>
            </span>
          </button>
          {totalPages > 1 ? (
            <>
              <span className="px-1.5 text-sm tabular-nums text-slate-500 dark:text-[var(--text-muted)]">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className={toolbarBtn}
              >
                Next
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/95">
              <th className="w-10 px-3 py-3" />
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Name
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Email
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Company
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Designation
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Country
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Industry
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  No leads match your filters.
                </td>
              </tr>
            ) : (
              rows.map(({ row, originalIndex }) => (
                <tr key={`${originalIndex}-${row.email}`} className="transition-colors hover:bg-slate-50/90">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={selectedIndices.has(originalIndex)}
                      onChange={() => onToggleRow(originalIndex)}
                      aria-label={`Select ${row.name || row.email}`}
                    />
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3 font-medium text-slate-900">
                    {row.name || '—'}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-slate-700">
                    {row.email || '—'}
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-slate-700">{row.company || '—'}</td>
                  <td className="max-w-[130px] truncate px-4 py-3 text-slate-600">{row.designation || '—'}</td>
                  <td className="max-w-[100px] truncate px-4 py-3 text-slate-600">{row.country || '—'}</td>
                  <td className="px-4 py-3">
                    {row.industry ? (
                      <span className="inline-block max-w-[120px] truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {row.industry}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'success' ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/70">
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 ring-1 ring-red-200/70">
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
