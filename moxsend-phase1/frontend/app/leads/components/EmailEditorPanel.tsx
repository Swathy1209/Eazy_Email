'use client';

import { useMemo, useState } from 'react';
import type { RowResult } from '@/lib/lead-types';
import { applyMergeTags, countMergeTags, htmlToPlainText } from '@/lib/merge-tags';
import { postJson } from '@/lib/fetch-json';
import { mockSubjectLine, type SubjectTone } from '@/lib/mock-subject-by-tone';

type EditorTab = 'html' | 'preview' | 'text';
const SUBJECT_TONES: SubjectTone[] = ['curious', 'urgent', 'friendly', 'professional', 'bold'];
const SUBJECT_TONE_LABELS: Record<SubjectTone, string> = {
  curious: 'Curious',
  urgent: 'Urgent',
  friendly: 'Friendly',
  professional: 'Professional',
  bold: 'Bold',
};

type Props = {
  sampleRow: RowResult | null;
  campaignTitle: string;
  onCampaignTitleChange: (v: string) => void;
  offerContext?: string;
  subject: string;
  bodyHtml: string;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onBodySelectionChange?: (sel: { variant: 'A' | 'B'; start: number; end: number }) => void;
  abEnabled: boolean;
  variant: 'A' | 'B';
  onVariantChange: (v: 'A' | 'B') => void;
  subjectB: string;
  bodyHtmlB: string;
  onSubjectBChange: (v: string) => void;
  onBodyBChange: (v: string) => void;
};

function audienceSummary(row: RowResult | null): string {
  if (!row) return '';
  return [row.name, row.company, row.industry, row.country].filter(Boolean).join(' · ');
}

/** Extra guard: API strips HTML from subject, but never apply rewrite response to the body. */
function subjectFromRewriteClient(raw: string): string {
  let s = raw.trim().split(/\r?\n/)[0]?.trim() ?? raw.trim();
  const tagAt = s.search(/<\s*[a-z]/i);
  if (tagAt >= 0) s = s.slice(0, tagAt).trim();
  return s;
}

export function EmailEditorPanel({
  sampleRow,
  campaignTitle,
  onCampaignTitleChange,
  offerContext = '',
  subject,
  bodyHtml,
  onSubjectChange,
  onBodyChange,
  onBodySelectionChange,
  abEnabled,
  variant,
  onVariantChange,
  subjectB,
  bodyHtmlB,
  onSubjectBChange,
  onBodyBChange,
}: Props) {
  const [tab, setTab] = useState<EditorTab>('html');
  const [subjectTone, setSubjectTone] = useState<SubjectTone>('curious');
  const [subjectOptions, setSubjectOptions] = useState<{ tone: SubjectTone; line: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState({
    rewriteSubject: false,
    rewriteBody: false,
    translateAr: false,
  });

  const activeSubject = abEnabled && variant === 'B' ? subjectB : subject;
  const activeBody = abEnabled && variant === 'B' ? bodyHtmlB : bodyHtml;
  const setSubject = abEnabled && variant === 'B' ? onSubjectBChange : onSubjectChange;
  const setBody = abEnabled && variant === 'B' ? onBodyBChange : onBodyChange;

  const reportBodySelection = (el: HTMLTextAreaElement | null) => {
    if (!el || !onBodySelectionChange) return;
    onBodySelectionChange({
      variant: abEnabled && variant === 'B' ? 'B' : 'A',
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? el.selectionStart ?? 0,
    });
  };

  const previewSubject = sampleRow ? applyMergeTags(activeSubject, sampleRow) : activeSubject;
  const previewHtml = sampleRow ? applyMergeTags(activeBody, sampleRow) : activeBody;
  const plain = htmlToPlainText(previewHtml);

  const stats = useMemo(() => {
    const htmlLen = activeBody.length;
    const plainLen = plain.length;
    const tags = countMergeTags(`${activeSubject}\n${activeBody}`);
    return { htmlLen, plainLen, tags };
  }, [activeBody, activeSubject, plain.length]);

  const tabs: { id: EditorTab; label: string }[] = [
    { id: 'html', label: 'HTML' },
    { id: 'preview', label: 'Preview' },
    { id: 'text', label: 'Plain text' },
  ];

  const runMockSubject = () => {
    setError(null);
    setSubjectOptions([]);
    const line = mockSubjectLine({
      tone: subjectTone,
      company: sampleRow?.company ?? '',
      name: sampleRow?.name ?? '',
      offerSnippet: offerContext || campaignTitle,
      role: sampleRow?.designation ?? '',
      industry: sampleRow?.industry ?? '',
    });
    setSubject(line);
  };

  const runMockSubjectOptions = () => {
    setError(null);
    const options = SUBJECT_TONES.map((tone) => ({
      tone,
      line: mockSubjectLine({
        tone,
        company: sampleRow?.company ?? '',
        name: sampleRow?.name ?? '',
        offerSnippet: offerContext || campaignTitle,
        role: sampleRow?.designation ?? '',
        industry: sampleRow?.industry ?? '',
      }),
    }));
    setSubjectOptions(options);
    if (options[0]?.line) setSubject(options[0].line);
  };

  const runRewriteSubject = async () => {
    if (!activeSubject.trim()) {
      setError('Add a subject to rewrite.');
      return;
    }
    setError(null);
    setBusy((b) => ({ ...b, rewriteSubject: true }));
    try {
      const data = await postJson<{ text?: string }>('/api/groq/rewrite', {
        field: 'subject',
        text: activeSubject,
        campaignTitle: campaignTitle || undefined,
        audienceSummary: audienceSummary(sampleRow),
        offerContext: offerContext || undefined,
      });
      if (data.text) {
        const line = subjectFromRewriteClient(data.text);
        if (line) setSubject(line);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rewrite failed');
    } finally {
      setBusy((b) => ({ ...b, rewriteSubject: false }));
    }
  };

  const runRewriteBody = async () => {
    if (!activeBody.trim()) {
      setError('Add body HTML to rewrite.');
      return;
    }
    setError(null);
    setBusy((b) => ({ ...b, rewriteBody: true }));
    try {
      const data = await postJson<{ text?: string }>('/api/groq/rewrite', {
        field: 'body',
        text: activeBody,
        campaignTitle: campaignTitle || undefined,
        audienceSummary: audienceSummary(sampleRow),
        offerContext: offerContext || undefined,
      });
      if (data.text) setBody(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rewrite failed');
    } finally {
      setBusy((b) => ({ ...b, rewriteBody: false }));
    }
  };

  const runTranslateAr = async () => {
    if (!activeSubject.trim() && !activeBody.trim()) {
      setError('Add a subject or body before translating.');
      return;
    }
    setError(null);
    setBusy((b) => ({ ...b, translateAr: true }));
    try {
      const data = await postJson<{ subject?: string; bodyHtml?: string }>('/api/groq/translate-ar', {
        subject: activeSubject,
        bodyHtml: activeBody,
        campaignTitle: campaignTitle || undefined,
        audienceSummary: audienceSummary(sampleRow),
        offerContext: offerContext || undefined,
      });
      if (data.subject !== undefined) setSubject(data.subject);
      if (data.bodyHtml !== undefined) setBody(data.bodyHtml);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setBusy((b) => ({ ...b, translateAr: false }));
    }
  };

  const anyBusy = busy.rewriteSubject || busy.rewriteBody || busy.translateAr;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Email editor</p>
          <p className="mt-1 text-sm text-slate-600">
            Simple composer with HTML, preview, and plain text. Merge tags stay intact for rewrite and translation.
          </p>
        </div>
        {abEnabled ? (
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
            {(['A', 'B'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onVariantChange(v)}
                className={`rounded-md px-3 py-1.5 transition ${
                  variant === v ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Variant {v}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-5 border-t border-slate-100 pt-5">
        <label htmlFor="campaign-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Title
        </label>
        <input
          id="campaign-title"
          value={campaignTitle}
          onChange={(e) => onCampaignTitleChange(e.target.value)}
          placeholder="Enter campaign title"
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="email-subject" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Subject
          </label>
        </div>
        <input
          id="email-subject"
          value={activeSubject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          placeholder="Exploring opportunities for {{company}}"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={subjectTone}
            onChange={(e) => setSubjectTone(e.target.value as SubjectTone)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            aria-label="Subject style for mock generation"
          >
            {SUBJECT_TONES.map((tone) => (
              <option key={tone} value={tone}>
                {SUBJECT_TONE_LABELS[tone]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={runMockSubject}
            disabled={!sampleRow}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:opacity-45"
          >
            Generate subject
          </button>
          <button
            type="button"
            onClick={runMockSubjectOptions}
            disabled={!sampleRow}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 transition hover:bg-indigo-100 disabled:opacity-45"
          >
            Generate 5 tones
          </button>
          <button
            type="button"
            onClick={() => void runRewriteSubject()}
            disabled={anyBusy}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-45"
          >
            {busy.rewriteSubject ? 'Rewriting…' : 'Rewrite subject'}
          </button>
        </div>
        {subjectOptions.length > 0 ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Subject options by tone
            </p>
            <div className="mt-2 space-y-1.5">
              {subjectOptions.map((opt) => {
                const selected = activeSubject.trim() === opt.line.trim();
                return (
                  <button
                    key={`${opt.tone}-${opt.line}`}
                    type="button"
                    onClick={() => setSubject(opt.line)}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                      selected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="mr-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {SUBJECT_TONE_LABELS[opt.tone]}
                    </span>
                    <span className="font-medium">{opt.line}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Body</span>
          <button
            type="button"
            onClick={() => void runRewriteBody()}
            disabled={anyBusy}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-45"
          >
            {busy.rewriteBody ? 'Rewriting…' : 'Rewrite body'}
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Compose in HTML, preview the result, or edit a plain-text version.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-100 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Merge tags: <code className="text-[11px]">{'{{name}}'}</code>, <code className="text-[11px]">{'{{company}}'}</code>, …
      </p>

      <div className="mt-2 min-h-[220px]">
        {tab === 'html' ? (
          <textarea
            value={activeBody}
            onChange={(e) => setBody(e.target.value)}
            onSelect={(e) => reportBodySelection(e.currentTarget)}
            onKeyUp={(e) => reportBodySelection(e.currentTarget)}
            onClick={(e) => reportBodySelection(e.currentTarget)}
            className="h-[280px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 p-3 font-mono text-xs leading-relaxed outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
            placeholder={'<h1>Hello {{name}}</h1>'}
            spellCheck={false}
          />
        ) : null}
        {tab === 'preview' ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject preview</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{previewSubject}</p>
            <div
              className="mt-4 max-w-none text-sm leading-relaxed text-slate-800 [&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_p]:my-2"
              dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-slate-400">—</p>' }}
            />
          </div>
        ) : null}
        {tab === 'text' ? (
          <pre className="h-[280px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
            {plain || '—'}
          </pre>
        ) : null}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void runTranslateAr()}
          disabled={anyBusy}
          className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100 disabled:opacity-45 sm:w-auto"
        >
          {busy.translateAr ? 'Translating…' : 'Translate to Arabic (natural, context-aware)'}
        </button>
        <p className="mt-1.5 text-xs text-slate-500">
          Replaces the current variant’s subject and HTML body with fluent Arabic; merge tags and structure are kept where
          possible.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
        <span>
          HTML length: <strong className="tabular-nums text-slate-900">{stats.htmlLen}</strong>
        </span>
        <span>
          Plain text length: <strong className="tabular-nums text-slate-900">{stats.plainLen}</strong>
        </span>
        <span>
          Merge tags: <strong className="tabular-nums text-slate-900">{stats.tags}</strong>
        </span>
      </div>
    </div>
  );
}
