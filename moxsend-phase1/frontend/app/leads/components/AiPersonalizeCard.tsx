'use client';

import type { RowResult } from '@/lib/lead-types';
import { MERGE_TAG_KEYS, type MergeTagKey } from '@/lib/merge-tags';
import type { EmailLength } from '@/lib/email-personalize-types';

const LENGTH_LABELS: Record<EmailLength, string> = {
  short: 'Short',
  medium: 'Medium (default)',
  long: 'Long',
};

type Props = {
  offer: string;
  onOfferChange: (v: string) => void;
  emailLength: EmailLength;
  onEmailLengthChange: (v: EmailLength) => void;
  personalize: MergeTagKey[];
  onPersonalizeChange: (v: MergeTagKey[]) => void;
  extraInstructions: string;
  onExtraInstructionsChange: (v: string) => void;
  sampleLead: RowResult | null;
  selectedCount: number;
  abEnabled: boolean;
  onAbChange: (v: boolean) => void;
  generating: boolean;
  generateError: string | null;
  subjectA: string;
  bodyA: string;
  subjectB: string;
  bodyB: string;
  onGenerate: () => void;
  onRegenerate: () => void;
  onSaveToDatabase?: () => void;
  saveSaving?: boolean;
  saveDisabled?: boolean;
  saveMessage?: string | null;
  saveMessageIsError?: boolean;
};

export function AiPersonalizeCard({
  offer,
  onOfferChange,
  emailLength,
  onEmailLengthChange,
  personalize,
  onPersonalizeChange,
  extraInstructions,
  onExtraInstructionsChange,
  sampleLead,
  selectedCount,
  abEnabled,
  onAbChange,
  generating,
  generateError,
  subjectA,
  bodyA,
  subjectB,
  bodyB,
  onGenerate,
  onRegenerate,
  onSaveToDatabase,
  saveSaving = false,
  saveDisabled = false,
  saveMessage = null,
  saveMessageIsError = false,
}: Props) {
  const toggleKey = (k: MergeTagKey) => {
    if (personalize.includes(k)) onPersonalizeChange(personalize.filter((x) => x !== k));
    else onPersonalizeChange([...personalize, k]);
  };

  const refLine = sampleLead
    ? `${sampleLead.name || `${sampleLead.firstname} ${sampleLead.lastname}`.trim()} · ${sampleLead.company || '—'} · ${sampleLead.industry || '—'}`
    : 'Select a reference contact in the list above.';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">AI Personalize</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Create one template for this cohort</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              The fields below apply to every selected recipient. Generate once; merge tags (e.g.{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">{'{{name}}'}</code>) swap in each
              person&apos;s data when you send.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
            <span className="text-slate-600">A/B testing</span>
            <button
              type="button"
              role="switch"
              aria-checked={abEnabled}
              onClick={() => onAbChange(!abEnabled)}
              className={`relative h-7 w-12 rounded-full transition ${abEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  abEnabled ? 'left-6' : 'left-0.5'
                }`}
              />
            </button>
            <span className="text-xs font-medium text-slate-500">{abEnabled ? 'On' : 'Off'}</span>
          </label>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">
        <div className="space-y-5 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              1
            </span>
            <h3 className="text-sm font-semibold text-slate-900">Offer &amp; constraints</h3>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
            <label htmlFor="offer-ta" className="text-xs font-medium text-slate-600">
              What are we offering? <span className="text-red-600">*</span>
            </label>
            <textarea
              id="offer-ta"
              required
              value={offer}
              onChange={(e) => onOfferChange(e.target.value)}
              placeholder="Example: A 14-day pilot of our outbound automation that books meetings into AE calendars, with copy tuned to your vertical."
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
            <p className="text-xs font-medium text-slate-600">Email length</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Rough target length for the body.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {(['short', 'medium', 'long'] as const).map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => onEmailLengthChange(len)}
                  className={`rounded-full px-3.5 py-2 text-xs font-medium transition ${
                    emailLength === len
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {LENGTH_LABELS[len]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
            <p className="text-xs font-medium text-slate-600">Personalize with</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Which fields to require in subject and body: name, company, industry, region, city, role, website.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {MERGE_TAG_KEYS.map((k) => {
                const on = personalize.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKey(k)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                      on
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
            <label htmlFor="extra" className="text-xs font-medium text-slate-600">
              Extra instructions <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="extra"
              value={extraInstructions}
              onChange={(e) => onExtraInstructionsChange(e.target.value)}
              placeholder="Tone: direct and confident. CTA: book a 15-min call. Avoid buzzwords."
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="space-y-5 bg-slate-50/50 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              2
            </span>
            <h3 className="text-sm font-semibold text-slate-900">Reference &amp; output</h3>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Preview reference</p>
            <p className="mt-2 text-sm font-medium text-slate-900">{refLine}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              <span className="font-medium text-slate-800">{selectedCount}</span> recipient(s). This row sets tone and
              preview; multi-recipient runs include the cohort in the generation request. The editor preview uses the same
              row for merge tags.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Generated template</p>
            {generating ? (
              <div className="mt-3 space-y-3 animate-pulse">
                <div className="h-4 w-2/3 rounded bg-slate-100" />
                <div className="h-24 rounded bg-slate-100" />
                {abEnabled ? <div className="h-24 rounded bg-slate-100" /> : null}
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Variant A — Subject</p>
                  <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900">
                    {subjectA || '—'}
                  </p>
                  <p className="mt-3 text-xs font-medium text-slate-500">Variant A — Body (HTML)</p>
                  <div
                    className="mt-1 max-h-40 overflow-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs leading-relaxed text-slate-800 [&_a]:text-slate-900 [&_p]:my-1"
                    dangerouslySetInnerHTML={{ __html: bodyA || '<p class="text-slate-400">Not generated yet.</p>' }}
                  />
                </div>
                {abEnabled ? (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-medium text-slate-500">Variant B — Subject</p>
                    <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900">
                      {subjectB || '—'}
                    </p>
                    <p className="mt-3 text-xs font-medium text-slate-500">Variant B — Body (HTML)</p>
                    <div
                      className="mt-1 max-h-40 overflow-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs leading-relaxed text-slate-800 [&_a]:text-slate-900 [&_p]:my-1"
                      dangerouslySetInnerHTML={{
                        __html: bodyB || '<p class="text-slate-400">Not generated yet.</p>',
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {generateError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {generateError}
            </div>
          ) : null}

          {saveMessage ? (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                saveMessageIsError
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              {saveMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating || !offer.trim() || selectedCount === 0}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:from-slate-700 hover:to-slate-800 disabled:pointer-events-none disabled:opacity-45"
            >
              {generating ? 'Generating…' : 'Generate for cohort'}
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={generating || !offer.trim() || selectedCount === 0}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-45"
            >
              Regenerate
            </button>
            {onSaveToDatabase ? (
              <button
                type="button"
                onClick={onSaveToDatabase}
                disabled={saveSaving || saveDisabled || generating || !subjectA.trim() || !bodyA.trim()}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-900 transition hover:bg-indigo-100 disabled:pointer-events-none disabled:opacity-45"
              >
                {saveSaving ? 'Saving…' : 'Save to database'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
