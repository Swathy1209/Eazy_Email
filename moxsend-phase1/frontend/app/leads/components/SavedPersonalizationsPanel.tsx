'use client';

import { useMemo, useState } from 'react';

type SavedRow = {
  id: string;
  created_at: string;
  import_job_id: string | null;
  reference_lead_email: string;
  reference_display: string;
  selected_lead_count: number;
  offer: string;
  extra_instructions: string;
  email_length: string;
  personalize_keys: string[] | null;
  ab_enabled: boolean;
  subject_a: string;
  body_html_a: string;
  subject_b: string | null;
  body_html_b: string | null;
};

type Props = {
  items: SavedRow[];
  loading: boolean;
  loadError: string | null;
  supabaseConfigured: boolean;
};

type LeadsFilter = 'all' | '1' | '2-9' | '10+';
type CreatedFilter = 'all' | '7d' | '30d' | '90d';

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function rowSearchHaystack(row: SavedRow): string {
  const tags = row.personalize_keys?.join(' ') ?? '';
  const bodyA = stripHtml(row.body_html_a || '');
  const bodyB = stripHtml(row.body_html_b || '');
  return [
    row.reference_display,
    row.reference_lead_email,
    row.offer,
    row.extra_instructions,
    row.subject_a,
    row.subject_b ?? '',
    bodyA,
    bodyB,
    tags,
    row.email_length,
  ]
    .join(' ')
    .toLowerCase();
}

function matchesLeadsFilter(count: number, f: LeadsFilter): boolean {
  switch (f) {
    case 'all':
      return true;
    case '1':
      return count === 1;
    case '2-9':
      return count >= 2 && count <= 9;
    case '10+':
      return count >= 10;
    default:
      return true;
  }
}

function matchesCreatedFilter(iso: string, f: CreatedFilter): boolean {
  if (f === 'all') return true;
  const days = f === '7d' ? 7 : f === '30d' ? 30 : 90;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

export function SavedPersonalizationsPanel({ items, loading, loadError, supabaseConfigured }: Props) {
  const [search, setSearch] = useState('');
  const [leadsFilter, setLeadsFilter] = useState<LeadsFilter>('all');
  const [createdFilter, setCreatedFilter] = useState<CreatedFilter>('all');

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (!matchesLeadsFilter(row.selected_lead_count ?? 0, leadsFilter)) return false;
      if (!matchesCreatedFilter(row.created_at, createdFilter)) return false;
      if (q && !rowSearchHaystack(row).includes(q)) return false;
      return true;
    });
  }, [items, search, leadsFilter, createdFilter]);

  const hasActiveFilters =
    search.trim() !== '' || leadsFilter !== 'all' || createdFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setLeadsFilter('all');
    setCreatedFilter('all');
  };

  if (!supabaseConfigured) {
    return (
      <div className="rounded-2xl border border-amber-200/90 bg-amber-50/80 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-900/80">Saved templates</p>
        <p className="mt-2 text-sm text-amber-950/90">
          Connect Supabase in the app environment to list and store generations here. Until then, use Generate and copy
          from the editor above.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">History</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Saved templates</h2>
          <p className="mt-1 text-sm text-slate-600">
            Stored in Supabase with timestamp, reference contact, offer, and your extra instructions.
          </p>
        </div>
      </div>

      {!loading && items.length > 0 ? (
        <div className="mt-5 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 sm:min-w-[200px]">
              <label htmlFor="saved-gemini-search" className="text-xs font-medium text-slate-600">
                Search
              </label>
              <input
                id="saved-gemini-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Contact, email, offer, subject, body text…"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-indigo-200"
                autoComplete="off"
              />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <label htmlFor="saved-gemini-leads" className="text-xs font-medium text-slate-600">
                Leads in cohort
              </label>
              <select
                id="saved-gemini-leads"
                value={leadsFilter}
                onChange={(e) => setLeadsFilter(e.target.value as LeadsFilter)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="all">Any size</option>
                <option value="1">1 lead</option>
                <option value="2-9">2–9 leads</option>
                <option value="10+">10+ leads</option>
              </select>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <label htmlFor="saved-gemini-created" className="text-xs font-medium text-slate-600">
                Created
              </label>
              <select
                id="saved-gemini-created"
                value={createdFilter}
                onChange={(e) => setCreatedFilter(e.target.value as CreatedFilter)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="all">Any time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Clear filters
              </button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filteredItems.length}</span> of{' '}
            <span className="font-semibold text-slate-700">{items.length}</span>. Newest saves are listed first.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</p>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-2 animate-pulse">
          <div className="h-16 rounded-lg bg-slate-100" />
          <div className="h-16 rounded-lg bg-slate-100" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No saves yet. Generate copy, then use &quot;Save to database&quot;.</p>
      ) : filteredItems.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No saves match your filters. Try adjusting search, cohort size, or date range — or{' '}
          <button type="button" onClick={clearFilters} className="font-medium text-indigo-700 underline hover:text-indigo-900">
            clear filters
          </button>
          .
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {filteredItems.map((row) => (
            <li key={row.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100/80 pb-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">{formatTime(row.created_at)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {row.reference_display || row.reference_lead_email || '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.reference_lead_email ? <span className="font-mono">{row.reference_lead_email}</span> : null}
                    {row.selected_lead_count ? (
                      <span className="ml-2">· {row.selected_lead_count} lead(s) selected</span>
                    ) : null}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                  {row.email_length} · {row.ab_enabled ? 'A/B' : 'A only'}
                </span>
              </div>
              <p className="mt-3 text-xs font-medium text-slate-500">Offer</p>
              <p className="mt-0.5 text-sm text-slate-800">{row.offer}</p>
              {row.extra_instructions?.trim() ? (
                <>
                  <p className="mt-3 text-xs font-medium text-slate-500">Extra instructions</p>
                  <p className="mt-0.5 text-sm text-slate-700">{row.extra_instructions}</p>
                </>
              ) : null}
              {row.personalize_keys?.length ? (
                <p className="mt-2 text-xs text-slate-500">
                  Tags:{' '}
                  <span className="font-medium text-slate-700">{row.personalize_keys.join(', ')}</span>
                </p>
              ) : null}
              <p className="mt-3 text-xs font-medium text-slate-500">Variant A — subject</p>
              <p className="mt-0.5 text-sm text-slate-900">{row.subject_a}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Variant A — body (HTML)</p>
              <div
                className="mt-1 max-h-36 overflow-auto rounded-lg border border-slate-100 bg-white p-2 text-xs leading-relaxed text-slate-800 [&_a]:text-slate-900 [&_p]:my-1"
                dangerouslySetInnerHTML={{ __html: row.body_html_a || '<p class="text-slate-400">—</p>' }}
              />
              {row.ab_enabled && (row.subject_b || row.body_html_b) ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-500">Variant B — subject</p>
                  <p className="mt-0.5 text-sm text-slate-900">{row.subject_b || '—'}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">Variant B — body (HTML)</p>
                  <div
                    className="mt-1 max-h-36 overflow-auto rounded-lg border border-slate-100 bg-white p-2 text-xs leading-relaxed text-slate-800 [&_a]:text-slate-900 [&_p]:my-1"
                    dangerouslySetInnerHTML={{ __html: row.body_html_b || '<p class="text-slate-400">—</p>' }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { SavedRow };
