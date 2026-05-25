'use client';

import type { RowResult } from '@/lib/lead-types';

export type SortKey = 'newest' | 'oldest' | 'name' | 'company' | 'status';

export type SendCountFilter = 'any' | '0' | '1+';

type Props = {
  fileLabel: string;
  totalLeads: number;
  search: string;
  onSearchChange: (v: string) => void;
  companySize: string;
  onCompanySizeChange: (v: string) => void;
  country: string;
  onCountryChange: (v: string) => void;
  industry: string;
  onIndustryChange: (v: string) => void;
  designation: string;
  onDesignationChange: (v: string) => void;
  leadStatus: 'all' | 'success' | 'failed';
  onLeadStatusChange: (v: 'all' | 'success' | 'failed') => void;
  leadType: string;
  onLeadTypeChange: (v: string) => void;
  tagsSelected: string[];
  onTagsChange: (v: string[]) => void;
  sortBy: SortKey;
  onSortChange: (v: SortKey) => void;
  sendCount: SendCountFilter;
  onSendCountChange: (v: SendCountFilter) => void;
  optionLists: {
    companySizes: string[];
    countries: string[];
    industries: string[];
    designations: string[];
    leadTypes: string[];
    allTags: string[];
  };
};

function uniqSorted(rows: RowResult[], pick: (r: RowResult) => string): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    const v = pick(r)?.trim();
    if (v) s.add(v);
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

export function buildFilterOptions(leads: RowResult[]) {
  return {
    companySizes: uniqSorted(leads, (r) => r.company_size),
    countries: uniqSorted(leads, (r) => r.country),
    industries: uniqSorted(leads, (r) => r.industry),
    designations: uniqSorted(leads, (r) => r.designation),
    leadTypes: uniqSorted(leads, (r) => r.lead_type),
    allTags: [
      ...new Set(
        leads.flatMap((r) =>
          (r.tags || '')
            .split(/[,;]+/)
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ),
    ].sort((a, b) => a.localeCompare(b)),
  };
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = label.replace(/\s/g, '-').toLowerCase();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterBar(props: Props) {
  const {
    fileLabel,
    totalLeads,
    search,
    onSearchChange,
    companySize,
    onCompanySizeChange,
    country,
    onCountryChange,
    industry,
    onIndustryChange,
    designation,
    onDesignationChange,
    leadStatus,
    onLeadStatusChange,
    leadType,
    onLeadTypeChange,
    tagsSelected,
    onTagsChange,
    sortBy,
    onSortChange,
    sendCount,
    onSendCountChange,
    optionLists,
  } = props;

  const toggleTag = (t: string) => {
    if (tagsSelected.includes(t)) onTagsChange(tagsSelected.filter((x) => x !== t));
    else onTagsChange([...tagsSelected, t]);
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-slate-100 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Filters</p>
        <p className="mt-1 text-sm text-slate-600">
          CSV file →{' '}
          <span className="font-medium text-slate-900">{fileLabel}</span>
          <span className="text-slate-400"> · </span>
          <span className="tabular-nums font-semibold text-slate-900">{totalLeads}</span> leads
        </p>
      </div>

      <div className="mt-4">
        <label htmlFor="lead-search" className="text-xs font-medium text-slate-600">
          Search
        </label>
        <input
          id="lead-search"
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, email, company, or designation"
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Select
          label="Company Size"
          value={companySize}
          onChange={onCompanySizeChange}
          options={[
            { value: '__all__', label: 'All' },
            ...optionLists.companySizes.map((v) => ({ value: v, label: v })),
          ]}
        />
        <Select
          label="Country"
          value={country}
          onChange={onCountryChange}
          options={[
            { value: '__all__', label: 'All' },
            ...optionLists.countries.map((v) => ({ value: v, label: v })),
          ]}
        />
        <Select
          label="Industry"
          value={industry}
          onChange={onIndustryChange}
          options={[
            { value: '__all__', label: 'All' },
            ...optionLists.industries.map((v) => ({ value: v, label: v })),
          ]}
        />
        <Select
          label="Designation"
          value={designation}
          onChange={onDesignationChange}
          options={[
            { value: '__all__', label: 'All' },
            ...optionLists.designations.map((v) => ({ value: v, label: v })),
          ]}
        />
        <Select
          label="Lead Status"
          value={leadStatus}
          onChange={(v) => onLeadStatusChange(v as 'all' | 'success' | 'failed')}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'success', label: 'Success' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
        <Select
          label="Lead Type"
          value={leadType}
          onChange={onLeadTypeChange}
          options={[
            { value: '__all__', label: 'All Types' },
            ...optionLists.leadTypes.map((v) => ({ value: v, label: v })),
          ]}
        />
        <Select
          label="Sort By"
          value={sortBy}
          onChange={(v) => onSortChange(v as SortKey)}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'name', label: 'Name A–Z' },
            { value: 'company', label: 'Company A–Z' },
            { value: 'status', label: 'Status (success first)' },
          ]}
        />
        <Select
          label="Send Count"
          value={sendCount}
          onChange={(v) => onSendCountChange(v as SendCountFilter)}
          options={[
            { value: 'any', label: 'Any count' },
            { value: '0', label: '0 (no prior output)' },
            { value: '1+', label: '1+ (has generated output)' },
          ]}
        />
      </div>

      {optionLists.allTags.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600">Tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {optionLists.allTags.map((t) => {
              const on = tagsSelected.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    on
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
