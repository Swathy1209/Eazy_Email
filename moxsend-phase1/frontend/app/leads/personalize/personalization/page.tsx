'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, postJson } from '@/lib/fetch-json';
import { loadLeadsSession } from '@/lib/leads-session';
import type { RowResult } from '@/lib/lead-types';
import { MERGE_TAG_KEYS, type MergeTagKey } from '@/lib/merge-tags';
import { ScoreBar } from '@/components/personalize/ScoreBar';

type GeneratedPayload = {
  subject: string;
  bodyHtml: string;
};

type MappingRow = {
  id: string;
  column: string;
  variable: MergeTagKey;
  confidence: number;
  autoDetected: boolean;
};

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function displayName(lead: RowResult): string {
  const fromNames = `${lead.firstname} ${lead.lastname}`.trim();
  return lead.name || fromNames || lead.email || 'Unknown';
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ensureEmailClosing(bodyHtml: string): string {
  const closingPattern = /(yours sincerely|sincerely|best regards|kind regards|warm regards|regards|yours truly|thank you|thanks)[\s\S]*$/i;
  const plainText = htmlToText(bodyHtml);
  if (closingPattern.test(plainText)) {
    return bodyHtml;
  }
  const closingHtml = '<p>Yours sincerely,<br/>Moxsend Team</p>';
  return `${bodyHtml.trim()}${bodyHtml.trim() ? '\n' : ''}${closingHtml}`;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectVariable(column: string): MergeTagKey {
  const normalized = normalizeToken(column);
  const matched = MERGE_TAG_KEYS.find((key) => normalizeToken(key) === normalized);
  if (matched) return matched;
  if (normalized.includes('first') || normalized.includes('name')) return 'name';
  if (normalized.includes('company') || normalized.includes('organization')) return 'company';
  if (normalized.includes('industry') || normalized.includes('sector')) return 'industry';
  if (normalized.includes('role') || normalized.includes('title') || normalized.includes('designation')) return 'role';
  return 'company';
}

function mappingConfidence(column: string, variable: string): number {
  const col = normalizeToken(column);
  const v = normalizeToken(variable);
  if (col === v) return 98;
  if (col.includes(v) || v.includes(col)) return 91;
  return 78;
}

function useTypewriter(value: string, speed = 10, enabled = true) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!enabled) {
      setTyped(value);
      return;
    }
    setTyped('');
    if (!value) return;
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setTyped(value.slice(0, i));
      if (i >= value.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [value, speed, enabled]);
  return typed;
}

function useAnimatedNumber(value: number, duration = 700) {
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    const start = displayValue;
    const delta = value - start;
    if (delta === 0) return;
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setDisplayValue(Math.round(start + delta * progress));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, displayValue]);
  return displayValue;
}

export default function PersonalizationPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<RowResult[]>([]);
  const [referenceLeadIndex, setReferenceLeadIndex] = useState(0);

  const [offer, setOffer] = useState('');
  const [emailLength, setEmailLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [personalize, setPersonalize] = useState<MergeTagKey[]>(['name', 'company', 'industry', 'role']);
  const [extraInstructions, setExtraInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const [generatedByLead, setGeneratedByLead] = useState<GeneratedPayload[]>([]);
  const [translatedByLead, setTranslatedByLead] = useState<GeneratedPayload[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [pendingColumn, setPendingColumn] = useState('');
  const [translating, setTranslating] = useState(false);
  const [hasAnimatedFirstGeneration, setHasAnimatedFirstGeneration] = useState(false);
  const [animateLeadIndex, setAnimateLeadIndex] = useState<number | null>(null);

  useEffect(() => {
    const s = loadLeadsSession();
    if (!s?.leads?.length) {
      router.replace('/leads');
      return;
    }
    const selectedIndices = [...new Set(s.selectedIndices ?? [])].filter((i) => i >= 0 && i < s.leads.length);
    if (!selectedIndices.length) {
      router.replace('/leads');
      return;
    }
    const leads = selectedIndices.map((i) => s.leads[i]);
    setJobId(s.jobId);
    setFileName(s.fileName || 'leads.csv');
    setSelectedLeads(leads);
    setGeneratedByLead(leads.map(() => ({ subject: '', bodyHtml: '' })));
    setTranslatedByLead(leads.map(() => ({ subject: '', bodyHtml: '' })));
    const sourceColumns = Array.from(
      new Set(
        leads.flatMap((lead) =>
          Object.keys(lead).filter((key) => {
            const value = lead[key as keyof RowResult];
            return Boolean(String(value ?? '').trim());
          }),
        ),
      ),
    );
    const fallbackColumns = ['first_name', 'last_name', 'company', 'role', 'industry', 'city', 'linkedin_post'];
    const columnCandidates = (sourceColumns.length ? sourceColumns : fallbackColumns).slice(0, 8);
    setCsvColumns(sourceColumns.length ? sourceColumns : fallbackColumns);
    setPendingColumn(columnCandidates[0] ?? '');
    setMappingRows(
      columnCandidates.map((column, index) => {
        const variable = detectVariable(column);
        return {
          id: `${column}-${index}`,
          column,
          variable,
          confidence: mappingConfidence(column, variable),
          autoDetected: true,
        };
      }),
    );
    setReady(true);
  }, [router]);

  const safeRef = Math.min(referenceLeadIndex, Math.max(selectedLeads.length - 1, 0));
  const sampleLead = selectedLeads[safeRef] ?? null;
  const selectedCount = selectedLeads.length;

  const activeGenerated = generatedByLead[safeRef] ?? { subject: '', bodyHtml: '' };
  const activeTranslated = translatedByLead[safeRef] ?? { subject: '', bodyHtml: '' };
  const activeContent = activeTranslated.subject || activeTranslated.bodyHtml ? activeTranslated : activeGenerated;
  const hasAnyGenerated = generatedByLead.some((item) => item.subject || item.bodyHtml);
  const hasAllGenerated = selectedLeads.length > 0 && generatedByLead.every((item) => item.subject && item.bodyHtml);
  const shouldAnimateActiveLead = animateLeadIndex === safeRef;

  const typedSubject = useTypewriter(activeContent.subject, 38, shouldAnimateActiveLead);
  const typedBody = useTypewriter(htmlToText(activeContent.bodyHtml), 18, shouldAnimateActiveLead);
  const rtl = Boolean(activeTranslated.subject || activeTranslated.bodyHtml);

  useEffect(() => {
    if (animateLeadIndex === null) return;
    const bodyText = htmlToText(activeContent.bodyHtml);
    if (safeRef !== animateLeadIndex) return;
    const subjectDone = typedSubject.length >= activeContent.subject.length;
    const bodyDone = typedBody.length >= bodyText.length;
    if (subjectDone && bodyDone) {
      setAnimateLeadIndex(null);
      setHasAnimatedFirstGeneration(true);
    }
  }, [animateLeadIndex, safeRef, activeContent, typedSubject.length, typedBody.length]);

  const scores = useMemo(() => {
    if (!hasAnyGenerated) {
      return { personalization: 0, cultural: 0, reply: 0 };
    }
    const personalization = Math.min(100, 38 + personalize.length * 9 + (offer.trim() ? 12 : 0));
    const cultural = Math.min(100, 42 + (extraInstructions.trim() ? 18 : 0) + (emailLength === 'long' ? 8 : 13));
    const reply = Math.min(100, Math.round(personalization * 0.4 + cultural * 0.6 - (emailLength === 'long' ? 5 : 0)));
    return { personalization, cultural, reply };
  }, [hasAnyGenerated, personalize.length, offer, extraInstructions, emailLength]);

  const anyTranslated = translatedByLead.some((item) => item.subject || item.bodyHtml);
  const sourceRows = anyTranslated ? translatedByLead : generatedByLead;
  const qualityScore = Math.round((scores.personalization + scores.cultural + scores.reply) / 3);
  const estimatedSeconds = Math.max(8, Math.round(selectedCount * 1.7));
  const validatedMappings = mappingRows.filter((row) => row.confidence >= 85).length;
  const unmappedColumns = csvColumns.filter((column) => !mappingRows.some((row) => row.column === column));

  const handleAddMappingColumn = useCallback(() => {
    if (!pendingColumn || mappingRows.some((row) => row.column === pendingColumn)) return;
    const variable = detectVariable(pendingColumn);
    setMappingRows((prev) => [
      ...prev,
      {
        id: `${pendingColumn}-${crypto.randomUUID()}`,
        column: pendingColumn,
        variable,
        confidence: mappingConfidence(pendingColumn, variable),
        autoDetected: false,
      },
    ]);
    setPersonalize((prev) => (prev.includes(variable) ? prev : [...prev, variable]));
    const remaining = unmappedColumns.filter((column) => column !== pendingColumn);
    setPendingColumn(remaining[0] ?? '');
  }, [pendingColumn, mappingRows, unmappedColumns]);

  const onGenerate = useCallback(async () => {
    if (!selectedLeads.length || !offer.trim()) return;
    setGenerating(true);
    setGenerateError(null);
    setSaveMessage(null);
    setTranslatedByLead(selectedLeads.map(() => ({ subject: '', bodyHtml: '' })));
    try {
      const generatedRows = await Promise.all(
        selectedLeads.map(async (lead) => {
          const traceId = crypto.randomUUID();
          const data = await postJson<{ subject: string; bodyHtml: string }>(
            '/api/groq/personalize-email',
            {
              offer: offer.trim(),
              length: emailLength,
              personalizeKeys: personalize,
              extraInstructions,
              sampleRow: lead,
              cohortRows: selectedLeads.length > 1 ? selectedLeads : undefined,
              jobId: jobId ?? undefined,
              variantLabel: 'A',
            },
            { traceId },
          );
          return { subject: data.subject, bodyHtml: ensureEmailClosing(data.bodyHtml) };
        }),
      );
      setGeneratedByLead(generatedRows);
      if (!hasAnimatedFirstGeneration) {
        setAnimateLeadIndex(safeRef);
      }
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'Generation failed');
      if (error instanceof ApiError && error.telemetry) {
        console.warn('Telemetry', error.telemetry);
      }
    } finally {
      setGenerating(false);
    }
  }, [selectedLeads, offer, emailLength, personalize, extraInstructions, jobId, hasAnimatedFirstGeneration, safeRef]);

  const onTranslate = useCallback(async () => {
    if (!hasAnyGenerated) return;
    setTranslating(true);
    setGenerateError(null);
    try {
      const translatedRows = await Promise.all(
        generatedByLead.map(async (item, index) => {
          if (!item.subject && !item.bodyHtml) return { subject: '', bodyHtml: '' };
          const lead = selectedLeads[index];
          const data = await postJson<{ subject: string; bodyHtml: string }>('/api/groq/translate-ar', {
            subject: item.subject,
            bodyHtml: item.bodyHtml,
            campaignTitle: `Cohort of ${selectedCount} leads`,
            audienceSummary: lead ? `${displayName(lead)} · ${lead.company}` : '',
            offerContext: offer,
          });
          return { subject: data.subject, bodyHtml: data.bodyHtml };
        }),
      );
      setTranslatedByLead(translatedRows);
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'Translation failed');
    } finally {
      setTranslating(false);
    }
  }, [hasAnyGenerated, generatedByLead, selectedLeads, selectedCount, offer]);

  const onSaveDraft = useCallback(async () => {
    if (!sampleLead || !activeContent.subject.trim() || !activeContent.bodyHtml.trim()) return;
    try {
      await postJson('/api/ai-personalize-saves', {
        importJobId: jobId,
        referenceLeadEmail: sampleLead.email,
        referenceDisplay: `${displayName(sampleLead)} · ${sampleLead.company || '—'} · ${sampleLead.industry || '—'}`,
        selectedLeadCount: selectedCount,
        offer: offer.trim(),
        extraInstructions,
        emailLength,
        personalizeKeys: personalize,
        subjectA: activeContent.subject,
        bodyHtmlA: activeContent.bodyHtml,
      });
      setSaveMessage('Draft saved successfully.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Save failed');
    }
  }, [sampleLead, activeContent, jobId, selectedCount, offer, extraInstructions, emailLength, personalize]);

  const onSaveAllDrafts = useCallback(async () => {
    if (!hasAllGenerated) return;
    setSavingAll(true);
    setSaveMessage(null);
    try {
      const rows = translatedByLead.some((row) => row.subject || row.bodyHtml) ? translatedByLead : generatedByLead;
      await Promise.all(
        selectedLeads.map(async (lead, index) => {
          const row = rows[index];
          if (!row?.subject || !row?.bodyHtml) return;
          await postJson('/api/ai-personalize-saves', {
            importJobId: jobId,
            referenceLeadEmail: lead.email,
            referenceDisplay: `${displayName(lead)} · ${lead.company || '—'} · ${lead.industry || '—'}`,
            selectedLeadCount: selectedCount,
            offer: offer.trim(),
            extraInstructions,
            emailLength,
            personalizeKeys: personalize,
            subjectA: row.subject,
            bodyHtmlA: row.bodyHtml,
          });
        }),
      );
      setSaveMessage('All generated emails saved to database.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Saving all emails failed');
    } finally {
      setSavingAll(false);
    }
  }, [hasAllGenerated, translatedByLead, generatedByLead, selectedLeads, jobId, selectedCount, offer, extraInstructions, emailLength, personalize]);

  const previewTemplate = useMemo(() => {
    const variableList = mappingRows.map((row) => `{{${row.variable}}}`);
    const first = variableList[0] ?? '{{first_name}}';
    const second = variableList[1] ?? '{{company}}';
    const third = variableList[2] ?? '{{industry}}';
    return `Hi ${first}, I noticed ${second} is scaling rapidly in ${third}. We built an AI outbound engine that personalizes each touchpoint at send-time without adding manual workload.`;
  }, [mappingRows]);

  const previewTokens = useMemo(() => previewTemplate.split(/(\{\{[^}]+\}\})/g).filter(Boolean), [previewTemplate]);

  const totalRows = selectedLeads.length;

  const animatedPersonalized = useAnimatedNumber(sourceRows.filter((row) => row.subject && row.bodyHtml).length);
  const animatedOpenings = useAnimatedNumber(new Set(sourceRows.map((row) => htmlToText(row.bodyHtml).split('\n').find((line) => line.trim()) ?? '')).size);
  const animatedVarsUsed = useAnimatedNumber(new Set(mappingRows.map((row) => row.variable)).size);
  const animatedTime = useAnimatedNumber(Math.max(1, Math.round(estimatedSeconds / Math.max(selectedCount || 1, 1))));

  if (!ready) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-xl border border-[#38BDF8]/20 bg-[#081522]/80" />
        <div className="h-96 animate-pulse rounded-xl border border-[#38BDF8]/20 bg-[#081522]/80" />
      </div>
    );
  }

  return (
    <section className="space-y-4 text-slate-900 dark:text-white">
      <header className="rounded-2xl border border-slate-200 !bg-white p-5 shadow-sm dark:border-cyan-300/35 dark:!bg-gradient-to-r dark:from-[#020812] dark:via-[#06111F] dark:to-[#081522] dark:shadow-[0_0_32px_rgba(0,200,255,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-[#8AA8BD]">AI Personalization Infrastructure</p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Enterprise Personalization Engine</h1>
          </div>
          <div className="rounded-full border border-cyan-300/55 !bg-cyan-50 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-700 dark:!bg-cyan-300/10 dark:text-cyan-200">
            AI Active
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-[#8CA9BD]">
          {selectedCount} contacts from {fileName}. Map lead data, validate AI confidence, and generate production-grade personalized emails.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 backdrop-blur-sm dark:border-cyan-300/30 dark:bg-[#06111F]/85">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 dark:text-white">Column Mapping Engine</h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-[#8BA8BB]">AI maps CSV headers to personalization variables with confidence scoring.</p>
              </div>
              <span className="rounded-full border border-cyan-300/55 bg-cyan-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-300/50 dark:bg-cyan-400/10 dark:text-cyan-200">
                AI Mapping
              </span>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-cyan-300/20 dark:bg-[#081522]/70">
              <select
                value={pendingColumn}
                onChange={(event) => setPendingColumn(event.target.value)}
                disabled={!unmappedColumns.length}
                className="min-w-[170px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none transition focus:border-cyan-500 disabled:opacity-50 dark:border-cyan-300/30 dark:bg-[#020812] dark:text-cyan-100 dark:focus:border-cyan-300/60"
              >
                {unmappedColumns.length ? (
                  unmappedColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))
                ) : (
                  <option value="">All CSV columns mapped</option>
                )}
              </select>
              <button
                type="button"
                onClick={handleAddMappingColumn}
                disabled={!pendingColumn || !unmappedColumns.length}
                className="rounded-lg border border-cyan-300/70 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-300/45 dark:bg-cyan-300/10 dark:text-cyan-100 dark:hover:bg-cyan-300/20"
              >
                Add column
              </button>
            </div>
            <div className="space-y-2">
              {mappingRows.map((row) => (
                <div
                  key={row.id}
                  className="group animate-fade-in grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-all duration-300 hover:border-cyan-400/60 dark:border-cyan-300/20 dark:bg-[#081522]/80 dark:hover:border-cyan-300/55 dark:hover:shadow-[0_0_16px_rgba(56,189,248,0.12)]"
                >
                  <div className="truncate rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-cyan-300/25 dark:bg-[#020812] dark:text-[#DFF6FF]">{row.column}</div>
                  <span className="text-cyan-600 transition-transform duration-300 group-hover:translate-x-1 dark:text-cyan-300">→</span>
                  <select
                    value={row.variable}
                    onChange={(event) => {
                      const variable = event.target.value as MergeTagKey;
                      setMappingRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id
                            ? { ...item, variable, autoDetected: false, confidence: mappingConfidence(item.column, variable) }
                            : item,
                        ),
                      );
                      setPersonalize((prev) => (prev.includes(variable) ? prev : [...prev, variable]));
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none transition focus:border-cyan-500 dark:border-cyan-300/30 dark:bg-[#020812] dark:text-cyan-100 dark:focus:border-cyan-300/60"
                  >
                    {MERGE_TAG_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {`{{${key}}}`}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5">
                    {row.autoDetected ? (
                      <span className="rounded-full border border-cyan-300/60 bg-cyan-50 px-1.5 py-0.5 text-[10px] text-cyan-700 dark:border-cyan-300/40 dark:bg-cyan-300/10 dark:text-cyan-200">auto</span>
                    ) : null}
                    <span className={`h-2 w-2 rounded-full ${row.confidence >= 90 ? 'bg-green-400' : row.confidence >= 80 ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                    <span className="text-[10px] text-slate-600 dark:text-[#9AB5C8]">{row.confidence}%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMappingRows((prev) => prev.filter((item) => item.id !== row.id));
                      setPendingColumn((current) => current || row.column);
                    }}
                    className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/45 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/20"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-700 dark:text-[#9AB5C8]">
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-cyan-300/20 dark:bg-[#020812]/80">Mapped: {mappingRows.length}</div>
              <div className="rounded-lg border border-green-300/60 bg-green-50 px-2 py-1.5 text-green-700 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-200">Validated: {validatedMappings}</div>
              <div className="rounded-lg border border-cyan-300/60 bg-cyan-50 px-2 py-1.5 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100">Active vars: {new Set(mappingRows.map((r) => r.variable)).size}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-cyan-300/30 dark:bg-[#06111F]/85">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-[0.16em] text-slate-600 dark:text-[#9AB4C7]">Live Template Preview</h3>
              <span className="text-[10px] text-cyan-700 dark:text-cyan-200">Streaming</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm leading-6 text-slate-800 dark:border-cyan-300/25 dark:bg-[#020812]/90 dark:text-[#E6F8FF]">
              {previewTokens.map((token, idx) =>
                token.startsWith('{{') ? (
                  <span
                    key={`${token}-${idx}`}
                    className="rounded bg-cyan-100 px-1 text-cyan-700 dark:bg-[#0F2838] dark:text-[#8EBDD4] dark:ring-1 dark:ring-cyan-500/15"
                  >
                    {token}
                  </span>
                ) : (
                  <span key={`${token}-${idx}`} className="text-slate-700 dark:text-[#D8ECF8]">
                    {token}
                  </span>
                ),
              )}
              <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-cyan-500 dark:bg-cyan-300" />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-[#87A6BB]">Preview regenerates instantly as mappings and variables update.</div>
          </div>

          <div className="rounded-2xl border border-slate-200 !bg-white p-4 dark:border-cyan-300/30 dark:!bg-gradient-to-r dark:from-[#081522] dark:to-[#06111F]">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Generate All Personalized Emails</h3>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 dark:border-cyan-300/20 dark:bg-[#020812]/70 dark:text-[#A4C0D0]">
                <p className="text-[10px] uppercase tracking-[0.12em]">Contacts</p>
                <p className="mt-1 text-base text-slate-900 dark:text-white">{selectedCount}</p>
              </div>
              <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-2 text-amber-700 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                <p className="text-[10px] uppercase tracking-[0.12em]">Est. time</p>
                <p className="mt-1 text-base">{estimatedSeconds}s</p>
              </div>
              <div className="rounded-lg border border-green-400/40 bg-green-50 p-2 text-green-700 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-100">
                <p className="text-[10px] uppercase tracking-[0.12em]">Quality</p>
                <p className="mt-1 text-base">{qualityScore}%</p>
              </div>
            </div>
            <div className="mt-3">
              <ScoreBar
                label="Generation Progress"
                value={generating ? 70 : hasAnyGenerated ? 100 : 16}
                tone="cyan"
                className={generating ? 'animate-pulse' : ''}
              />
            </div>
            <div className="mt-3 space-y-3">
              <label className="text-xs text-slate-500 dark:text-[#9AB6C8]">Offer & Constraints</label>
              <textarea
                value={offer}
                onChange={(event) => setOffer(event.target.value)}
                rows={3}
                placeholder="Describe the offer, value proposition, and guardrails..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-400 dark:border-cyan-300/35 dark:bg-[#020812]/90 dark:text-white dark:focus:border-cyan-300/70 dark:focus:shadow-[0_0_12px_rgba(56,189,248,0.2)]"
              />
              <label className="text-xs text-slate-500 dark:text-[#9AB6C8]">Extra Instructions</label>
              <textarea
                value={extraInstructions}
                onChange={(event) => setExtraInstructions(event.target.value)}
                rows={2}
                placeholder="Tone, CTA behavior, vertical-specific context..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-400 dark:border-cyan-300/35 dark:bg-[#020812]/90 dark:text-white dark:focus:border-cyan-300/70 dark:focus:shadow-[0_0_12px_rgba(56,189,248,0.2)]"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs dark:border-cyan-300/20 dark:bg-[#020812]/65">
              {(['short', 'medium', 'long'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmailLength(item)}
                  className={`rounded-md px-2 py-1.5 capitalize transition ${
                    emailLength === item
                      ? 'bg-cyan-100 text-cyan-700 shadow-[inset_0_0_0_1px_rgba(8,145,178,0.35)] dark:bg-cyan-300/20 dark:text-cyan-100 dark:shadow-[inset_0_0_0_1px_rgba(56,189,248,0.65)]'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-[#8CA9BE] dark:hover:bg-[#081522]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {MERGE_TAG_KEYS.map((key) => {
                const active = personalize.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setPersonalize((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
                    }
                    className={`rounded-md border px-2 py-1 text-[11px] transition ${
                      active
                        ? 'border-cyan-300/65 bg-cyan-100 text-cyan-700 dark:bg-cyan-300/15 dark:text-cyan-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 dark:border-cyan-300/25 dark:bg-[#020812]/80 dark:text-[#8CAAC0] dark:hover:border-cyan-300/50'
                    }`}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={generating || !offer.trim()}
                onClick={() => void onGenerate()}
                className="rounded-xl border border-cyan-300/70 bg-cyan-50 px-4 py-2 text-sm text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-300/60 dark:bg-cyan-300/15 dark:text-cyan-100 dark:hover:bg-cyan-300/25"
              >
                {generating ? 'AI processing...' : 'Run personalization engine'}
              </button>
              <button
                type="button"
                disabled={translating || !hasAnyGenerated}
                onClick={() => void onTranslate()}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-cyan-300 disabled:opacity-50 dark:border-cyan-300/35 dark:bg-[#020812] dark:text-[#CFEFFF] dark:hover:border-cyan-300/60"
              >
                {translating ? 'Streaming translation...' : 'Translate to Arabic'}
              </button>
              <button
                type="button"
                disabled={savingAll || !hasAllGenerated}
                onClick={() => void onSaveAllDrafts()}
                className="rounded-xl border border-green-400/50 bg-green-50 px-4 py-2 text-sm text-green-700 transition hover:bg-green-100 disabled:opacity-50 dark:border-green-400/45 dark:bg-green-400/10 dark:text-green-200 dark:hover:bg-green-400/20"
              >
                {savingAll ? 'Saving...' : 'Save all to DB'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-300/30 bg-[#06111F]/85 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white">Lead-Level Personalized Outputs</h2>
              <span className="rounded-full border border-cyan-300/40 px-2 py-0.5 text-[10px] text-cyan-200">{totalRows}+ scalable</span>
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto rounded-xl border border-cyan-300/20 bg-[#020812]/85 p-2">
              {selectedLeads.map((lead, index) => {
                const content = sourceRows[index] ?? { subject: '', bodyHtml: '' };
                const openingLine = htmlToText(content.bodyHtml).split('\n').find((line) => line.trim()) ?? 'Pending generation...';
                const active = safeRef === index;
                const status = content.subject ? 'generated' : generating ? 'processing' : 'queued';
                return (
                  <button
                    key={`${lead.email}-${index}`}
                    type="button"
                    onClick={() => setReferenceLeadIndex(index)}
                    className={`w-full rounded-xl border p-3 text-left transition duration-300 ${
                      active
                        ? 'border-cyan-300/60 bg-[#081522] shadow-[0_0_18px_rgba(0,200,255,0.2)]'
                        : 'border-cyan-300/20 bg-[#06111F]/75 hover:border-cyan-300/45'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300/20 text-[11px] font-semibold text-cyan-100">
                          {initials(displayName(lead))}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-white">{displayName(lead)}</p>
                          <p className="truncate text-[11px] text-[#8DAABD]">{lead.company || 'Unknown company'}</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-200">AI personal</span>
                    </div>
                    <p className="mt-2 truncate text-[11px] text-[#BFD8E7]">{openingLine}</p>
                    <p
                      className={`mt-1 text-[10px] uppercase tracking-[0.12em] ${
                        status === 'generated' ? 'text-green-300' : status === 'processing' ? 'text-cyan-300' : 'text-amber-300'
                      }`}
                    >
                      {status}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-300/30 bg-[#06111F]/85 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#9AB4C7]">Active Lead Preview</h3>
              <button
                type="button"
                disabled={!activeContent.subject && !activeContent.bodyHtml}
                onClick={() => navigator.clipboard.writeText(`${activeContent.subject}\n\n${htmlToText(activeContent.bodyHtml)}`)}
                className="rounded-md border border-cyan-300/30 px-2 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-300/60 disabled:opacity-50"
              >
                Copy
              </button>
            </div>
            {generating ? (
              <div className="space-y-2">
                <div className="h-5 animate-pulse rounded bg-[#081522]" />
                <div className="h-28 animate-pulse rounded bg-[#081522]" />
              </div>
            ) : (
              <div className="space-y-2" dir={rtl ? 'rtl' : 'ltr'}>
                <div className="rounded-lg border border-cyan-300/20 bg-[#020812]/85 p-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[#8EAABE]">Subject</p>
                  <p className={`mt-1 text-sm text-white ${rtl ? 'font-["Tahoma"] leading-8' : ''}`}>
                    {typedSubject}
                    {typedSubject.length < activeContent.subject.length ? <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-cyan-300" /> : null}
                  </p>
                </div>
                <div className="rounded-lg border border-cyan-300/20 bg-[#020812]/85 p-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[#8EAABE]">Body</p>
                  <pre className={`mt-1 whitespace-pre-wrap text-xs text-[#D9EDFA] ${rtl ? 'font-["Tahoma"] leading-8' : 'leading-5'}`}>
                    {typedBody}
                    {typedBody.length < htmlToText(activeContent.bodyHtml).length ? (
                      <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-cyan-300" />
                    ) : null}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {generateError ? (
            <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{generateError}</p>
          ) : null}
          {saveMessage ? (
            <p className="rounded-lg border border-green-400/45 bg-green-400/10 px-3 py-2 text-xs text-green-200">{saveMessage}</p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-cyan-300/25 bg-[#081522]/85 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#93B0C3]">Emails personalized</p>
              <p className="mt-1 text-lg font-semibold text-white">{animatedPersonalized}</p>
            </div>
            <div className="rounded-xl border border-cyan-300/25 bg-[#081522]/85 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#93B0C3]">Unique openings</p>
              <p className="mt-1 text-lg font-semibold text-cyan-100">{animatedOpenings}</p>
            </div>
            <div className="rounded-xl border border-cyan-300/25 bg-[#081522]/85 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#93B0C3]">Variables used</p>
              <p className="mt-1 text-lg font-semibold text-cyan-100">{animatedVarsUsed}</p>
            </div>
            <div className="rounded-xl border border-cyan-300/25 bg-[#081522]/85 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#93B0C3]">Avg generation time</p>
              <p className="mt-1 text-lg font-semibold text-white">{animatedTime}s</p>
            </div>
            <div className="rounded-xl border border-cyan-300/25 bg-[#081522]/85 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#93B0C3]">AI confidence</p>
              <p className="mt-1 text-lg font-semibold text-cyan-100">{scores.personalization}%</p>
            </div>
            <div className="rounded-xl border border-cyan-300/25 bg-[#081522]/85 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#93B0C3]">Personalization quality</p>
              <p className="mt-1 text-lg font-semibold text-green-200">{qualityScore}%</p>
            </div>
          </div>

          <div className="grid gap-2">
            <ScoreBar label="Personalization Score" value={scores.personalization} tone="cyan" />
            <ScoreBar label="Cultural Fit" value={scores.cultural} tone="emerald" />
            <ScoreBar label="Reply Likelihood" value={scores.reply} tone="amber" />
          </div>
        </div>
      </div>
    </section>
  );
}
