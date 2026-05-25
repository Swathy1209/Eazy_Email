'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EmailTemplate } from '@/lib/mock-templates';
import { listTemplates, searchTemplates } from '@/lib/mock-templates';

type Props = {
  onApplyTemplate: (t: EmailTemplate) => void;
  onInsertSnippet: (html: string) => void;
};

export function TemplateToolsBar({ onApplyTemplate, onInsertSnippet }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  const templates = useMemo(() => {
    void refreshKey;
    return searchTemplates(query);
  }, [query, refreshKey]);

  const selected =
    templates.find((t) => t.id === selectedId) ?? templates[0] ?? null;

  useEffect(() => {
    if (templates.length && !templates.some((t) => t.id === selectedId)) {
      setSelectedId(templates[0].id);
    }
  }, [templates, selectedId]);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/70 p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Template tools</p>
      <p className="mt-1 text-sm text-slate-600">Pick a starter, then apply full template or snippet.</p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="tmpl-search" className="text-xs font-medium text-slate-600">
            Smart search
          </label>
          <input
            id="tmpl-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or category"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <select
            value={selected?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={templates.length === 0}
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
          >
            {templates.length === 0 ? (
              <option value="">No matches</option>
            ) : (
              templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.category}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Refresh templates
          </button>
        </div>
        {selected ? (
          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-xs text-slate-600 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-800">{selected.name}</p>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {selected.category}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 p-2 text-slate-700">{selected.subject}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onApplyTemplate(selected)}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                Apply template
              </button>
              <button
                type="button"
                onClick={() => onInsertSnippet(selected.snippet)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Insert snippet
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
