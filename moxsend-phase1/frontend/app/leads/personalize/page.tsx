'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, postJson } from '@/lib/fetch-json';
import { loadLeadsSession } from '@/lib/leads-session';
import type { RowResult } from '@/lib/lead-types';
import {
  cohortSignature,
  loadPersonalizeWorkspaceSnapshot,
  savePersonalizeWorkspaceSnapshot,
  type PersonalizeLeadSlotSnapshot,
} from '@/lib/personalize-workspace-cache';
import { MERGE_TAG_KEYS, type MergeTagKey } from '@/lib/merge-tags';
import { ScoreBar } from '@/components/personalize/ScoreBar';
import { SubjectOptimizer } from '@/components/personalize/SubjectOptimizer';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { stableLeadId } from '@/lib/lead-id';
import { BenchmarkModal } from '@/components/personalize/BenchmarkModal';


function normalizeMergeKeys(keys: unknown): MergeTagKey[] {
  if (!Array.isArray(keys)) return ['name', 'company', 'industry', 'role'];
  const allowed = new Set<string>(MERGE_TAG_KEYS as unknown as string[]);
  const out = keys.filter((k): k is MergeTagKey => typeof k === 'string' && allowed.has(k));
  return out.length ? out : ['name', 'company', 'industry', 'role'];
}

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

function unpackPackedEmail(packed: string | object): { subject: string; bodyHtml: string; personalization_reasoning?: string; humanization_analysis?: string } | null {
  try {
    const o = (typeof packed === 'string' ? JSON.parse(packed) : packed) as { 
      subject?: unknown; 
      bodyHtml?: unknown;
      personalization_reasoning?: string;
      humanization_analysis?: string;
    };
    const subject = String(o.subject ?? '').trim();
    const bodyHtml = String(o.bodyHtml ?? '').trim();
    if (subject && bodyHtml) return { 
      subject, 
      bodyHtml,
      personalization_reasoning: o.personalization_reasoning,
      humanization_analysis: o.humanization_analysis
    };
  } catch {
    /* ignore */
  }
  return null;
}

function resolveDisplayed(slot: PersonalizeLeadSlotSnapshot | undefined): {
  subject: string;
  bodyHtml: string;
  rtl: boolean;
  reasoning?: string;
  analysis?: string;
} {
  if (!slot) return { subject: '', bodyHtml: '', rtl: false };
  const subject = slot.arSubject || slot.refinedSubject || slot.subject || '';
  const bodyHtml = slot.arBodyHtml || slot.refinedBodyHtml || slot.bodyHtml || '';
  const rtl = Boolean(slot.arSubject || slot.arBodyHtml);
  return { 
    subject, 
    bodyHtml, 
    rtl,
    reasoning: slot.personalizationReasoning,
    analysis: slot.humanizationAnalysis
  };
}

function englishBase(slot: PersonalizeLeadSlotSnapshot | undefined): { subject: string; bodyHtml: string } {
  if (!slot) return { subject: '', bodyHtml: '' };
  return {
    subject: slot.subject,
    bodyHtml: slot.bodyHtml,
  };
}

export default function PersonalizePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<RowResult[]>([]);

  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [leadSlots, setLeadSlots] = useState<Record<string, PersonalizeLeadSlotSnapshot>>({});

  const [offer, setOffer] = useState('');
  const [emailLength, setEmailLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [personalize, setPersonalize] = useState<MergeTagKey[]>(['name', 'company', 'industry', 'role']);
  const [extraInstructions, setExtraInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [translating, setTranslating] = useState(false);

  const [hasAnimatedFirstGeneration, setHasAnimatedFirstGeneration] = useState(false);
  const [animateLeadId, setAnimateLeadId] = useState<string | null>(null);

  const [refineDrafts, setRefineDrafts] = useState<Record<string, string>>({});
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);


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
    const sig = cohortSignature(leads);
    const snapshot = loadPersonalizeWorkspaceSnapshot(s.jobId ?? null, sig, leads);

    setJobId(s.jobId);
    setFileName(s.fileName || 'leads.csv');
    setSelectedLeads(leads);

    if (snapshot) {
      setOffer(snapshot.offer ?? '');
      const el = snapshot.emailLength;
      setEmailLength(el === 'short' || el === 'medium' || el === 'long' ? el : 'medium');
      setPersonalize(normalizeMergeKeys(snapshot.personalizeKeys));
      setExtraInstructions(snapshot.extraInstructions ?? '');
      setLeadSlots(snapshot.slotsByLeadId ?? {});
      setActiveLeadId(snapshot.activeLeadId && leads.some((l) => stableLeadId(l) === snapshot.activeLeadId) ? snapshot.activeLeadId : stableLeadId(leads[0]));
      setHasAnimatedFirstGeneration(Boolean(snapshot.hasAnimatedFirstGeneration));
    } else {
      setLeadSlots({});
      setActiveLeadId(stableLeadId(leads[0]));
      setHasAnimatedFirstGeneration(false);
    }
    setReady(true);
  }, [router]);

  const selectedCount = selectedLeads.length;
  const activeLead = activeLeadId ? selectedLeads.find((l) => stableLeadId(l) === activeLeadId) ?? null : null;
  const activeSlot = activeLeadId ? leadSlots[activeLeadId] : undefined;
  const displayed = resolveDisplayed(activeSlot);
  const refineInput = activeLeadId ? refineDrafts[activeLeadId] ?? '' : '';

  const hasAnyGenerated = useMemo(
    () => Object.values(leadSlots).some((s) => s.subject.trim() && s.bodyHtml.trim()),
    [leadSlots],
  );

  const shouldAnimateActiveLead = Boolean(activeLeadId && animateLeadId === activeLeadId);
  const activeLeadContext = useMemo(() => {
    if (!activeLead) return '';
    const parts = [
      activeLead.firstname || activeLead.lastname ? `Name: ${[activeLead.firstname, activeLead.lastname].filter(Boolean).join(' ').trim()}` : '',
      activeLead.company ? `Company: ${activeLead.company}` : '',
      activeLead.designation ? `Role: ${activeLead.designation}` : '',
      activeLead.industry ? `Industry: ${activeLead.industry}` : '',
      activeLead.country ? `Country: ${activeLead.country}` : '',
      activeLead.city ? `City: ${activeLead.city}` : '',
      activeLead.company_size ? `Company size: ${activeLead.company_size}` : '',
      activeLead.notes ? `Notes: ${activeLead.notes}` : '',
    ].filter(Boolean);
    return parts.join(' | ');
  }, [activeLead]);

  const typedSubject = useTypewriter(displayed.subject, 38, shouldAnimateActiveLead);
  const typedBody = useTypewriter(htmlToText(displayed.bodyHtml), 18, shouldAnimateActiveLead);

  useEffect(() => {
    if (animateLeadId === null || !activeLeadId) return;
    const bodyText = htmlToText(displayed.bodyHtml);
    if (activeLeadId !== animateLeadId) return;
    const subjectDone = typedSubject.length >= displayed.subject.length;
    const bodyDone = typedBody.length >= bodyText.length;
    if (subjectDone && bodyDone) {
      setAnimateLeadId(null);
      setHasAnimatedFirstGeneration(true);
    }
  }, [animateLeadId, activeLeadId, displayed, typedSubject.length, typedBody.length]);

  useEffect(() => {
    if (!ready || selectedLeads.length === 0) return;
    savePersonalizeWorkspaceSnapshot({
      jobId,
      cohortSignature: cohortSignature(selectedLeads),
      offer,
      emailLength,
      personalizeKeys: personalize,
      extraInstructions,
      activeLeadId,
      slotsByLeadId: leadSlots,
      hasAnimatedFirstGeneration,
    });
  }, [
    ready,
    jobId,
    selectedLeads,
    offer,
    emailLength,
    personalize,
    extraInstructions,
    activeLeadId,
    leadSlots,
    hasAnimatedFirstGeneration,
  ]);

  const scores = useMemo(() => {
    if (!hasAnyGenerated || !activeSlot) {
      return { personalization: 0, cultural: 0, reply: 0 };
    }
    // Prioritize real scores from activeSlot if they exist
    if (activeSlot.personalizationScore !== undefined || activeSlot.culturalScore !== undefined || activeSlot.replyLikelihood !== undefined) {
      return {
        personalization: activeSlot.personalizationScore ?? 0,
        cultural: activeSlot.culturalScore ?? 0,
        reply: activeSlot.replyLikelihood ?? 0,
      };
    }
    // Heuristic fallback
    const personalization = Math.min(100, 38 + personalize.length * 9 + (offer.trim() ? 12 : 0));
    const cultural = Math.min(100, 42 + (extraInstructions.trim() ? 18 : 0) + (emailLength === 'long' ? 8 : 13));
    const reply = Math.min(100, Math.round(personalization * 0.4 + cultural * 0.6 - (emailLength === 'long' ? 5 : 0)));
    return { personalization, cultural, reply };
  }, [hasAnyGenerated, activeSlot, personalize.length, offer, extraInstructions, emailLength]);

  const onGenerateCohort = useCallback(async () => {
    if (!selectedLeads.length || !offer.trim()) return;
    setGenerating(true);
    setGenerateError(null);
    setSaveFeedback(null);
    setIsOptimizerOpen(false);
    try {
      const traceId = crypto.randomUUID();
      const data = await postJson<{
        success: boolean;
        emails?: { leadId: string; email: string }[];
        error?: string;
      }>(
        '/api/leads/personalize/cohort',
        {
          leadIds: selectedLeads.map((l) => stableLeadId(l)),
          leadRecords: selectedLeads,
          aiConfig: {
            offer: offer.trim(),
            emailLength,
            personalizeWith: personalize,
            extraInstructions,
          },
          importJobId: jobId,
        },
        { traceId },
      );

      if (!data.success || !data.emails?.length) {
        throw new Error(data.error || 'Cohort generation failed');
      }

      setLeadSlots((prev) => {
        const next = { ...prev };
        for (const lead of selectedLeads) {
          const id = stableLeadId(lead);
          const item = data.emails!.find((e) => e.leadId === id);
          const parsed = item ? unpackPackedEmail(item.email) : null;
          if (parsed) {
            next[id] = {
              subject: parsed.subject,
              bodyHtml: parsed.bodyHtml,
            };
          }
        }
        return next;
      });

      if (!hasAnimatedFirstGeneration && activeLeadId) {
        setAnimateLeadId(activeLeadId);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Cohort generation failed';
      setGenerateError(msg);
      if (e instanceof ApiError && e.telemetry) {
        console.warn('Telemetry', e.telemetry);
      }
    } finally {
      setGenerating(false);
    }
  }, [selectedLeads, offer, emailLength, personalize, extraInstructions, jobId, hasAnimatedFirstGeneration, activeLeadId]);

  const onTranslateActive = useCallback(async () => {
    if (!activeLeadId || !activeSlot) return;
    const { subject, bodyHtml } = englishBase(activeSlot);
    if (!subject || !bodyHtml) return;
    setTranslating(true);
    setGenerateError(null);
    try {
      const data = await postJson<{ subject: string; bodyHtml: string }>('/api/groq/translate-ar', {
        subject,
        bodyHtml,
        campaignTitle: `Cohort of ${selectedCount} leads`,
        audienceSummary: activeLead ? `${displayName(activeLead)} · ${activeLead.company}` : '',
        offerContext: offer,
      });
      setLeadSlots((prev) => ({
        ...prev,
        [activeLeadId]: {
          ...(prev[activeLeadId] ?? { subject: '', bodyHtml: '' }),
          arSubject: data.subject,
          arBodyHtml: data.bodyHtml,
        },
      }));
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'Translation failed');
    } finally {
      setTranslating(false);
    }
  }, [activeLeadId, activeSlot, activeLead, selectedCount, offer]);

  const onRefineActive = useCallback(async () => {
    if (!activeLeadId || !activeSlot) return;
    const promptText = refineInput.trim();
    if (!promptText) return;

    const base = englishBase(activeSlot);
    if (!base.subject || !base.bodyHtml) return;

    setRefining(true);
    setGenerateError(null);
    setSaveFeedback(null);
    try {
      const currentEmail = JSON.stringify({ subject: base.subject, bodyHtml: base.bodyHtml });
      const data = await postJson<{ success: boolean; email?: string; error?: string }>(
        '/api/leads/personalize/refine',
        {
          leadId: activeLeadId,
          currentEmail,
          refinementPrompt: promptText,
          leadRecord: activeLead ?? null,
        },
      );

      if (!data.success || !data.email) {
        throw new Error(data.error || 'Refinement failed');
      }

      const parsed = unpackPackedEmail(data.email);
      if (!parsed) {
        throw new Error('Invalid refine response');
      }

      setLeadSlots((prev) => ({
        ...prev,
        [activeLeadId]: {
          ...(prev[activeLeadId] ?? { subject: '', bodyHtml: '' }),
          refinedSubject: parsed.subject,
          refinedBodyHtml: parsed.bodyHtml,
          personalizationReasoning: parsed.personalization_reasoning,
          humanizationAnalysis: parsed.humanization_analysis,
          arSubject: undefined,
          arBodyHtml: undefined,
        },
      }));

      setRefineDrafts((d) => ({ ...d, [activeLeadId]: '' }));
      setSaveFeedback({ type: 'success', message: 'Email refined. Save when you are ready.' });
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Refinement failed');
    } finally {
      setRefining(false);
    }
  }, [activeLeadId, activeSlot, refineInput]);

  const onSaveActiveLead = useCallback(async () => {
    if (!activeLead || !activeLeadId) return;
    const disp = resolveDisplayed(leadSlots[activeLeadId]);
    if (!disp.subject.trim() || !disp.bodyHtml.trim()) {
      setSaveFeedback({ type: 'error', message: 'Nothing to save for this lead.' });
      return;
    }

    setSavingLead(true);
    setSaveFeedback(null);
    try {
      const out = await postJson<{ success: boolean; savedAt?: string; error?: string }>(
        '/api/leads/personalize/save',
        {
          leadId: activeLeadId,
          recipientEmail: String(activeLead.email ?? '').trim(),
          referenceDisplay: `${displayName(activeLead)} · ${activeLead.company || '—'} · ${activeLead.industry || '—'}`,
          selectedLeadCount: selectedCount,
          offer: offer.trim(),
          extraInstructions,
          emailLength,
          personalizeWith: personalize,
          subject: disp.subject,
          bodyHtml: disp.bodyHtml,
          importJobId: jobId,
        },
      );

      if (!out.success) {
        throw new Error(out.error || 'Save failed');
      }

      const ts = out.savedAt ?? new Date().toISOString();
      setLeadSlots((prev) => ({
        ...prev,
        [activeLeadId]: {
          ...(prev[activeLeadId] ?? { subject: '', bodyHtml: '' }),
          lastSavedAt: ts,
        },
      }));
      setSaveFeedback({ type: 'success', message: 'Saved personalized email for this lead.' });
    } catch (error) {
      setSaveFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Save failed',
      });
    } finally {
      setSavingLead(false);
    }
  }, [activeLead, activeLeadId, leadSlots, selectedCount, offer, extraInstructions, emailLength, personalize, jobId]);

  const onClearOfferFields = useCallback(() => {
    setOffer('');
    setExtraInstructions('');
    setSaveFeedback(null);
  }, []);

  const setRefineInput = useCallback(
    (value: string) => {
      if (!activeLeadId) return;
      setRefineDrafts((d) => ({ ...d, [activeLeadId]: value }));
    },
    [activeLeadId],
  );

  const handleBenchmarkSelect = useCallback((subject: string, bodyHtml: string, metrics?: any) => {
    if (!activeLeadId) return;
    setLeadSlots((prev) => ({
      ...prev,
      [activeLeadId]: {
        ...(prev[activeLeadId] ?? { subject: '', bodyHtml: '' }),
        refinedSubject: subject,
        refinedBodyHtml: bodyHtml,
        arSubject: undefined,
        arBodyHtml: undefined,
        // Update scores and summaries from metrics
        ...(metrics ? {
          personalizationScore: metrics.personalization_score,
          culturalScore: metrics.cultural_fit_score,
          replyLikelihood: metrics.quality_score,
          personalizationReasoning: metrics.evaluator_summary,
          humanizationAnalysis: metrics.humanization_summary
        } : {})
      },
    }));
    setSaveFeedback({ type: 'success', message: `Model output applied for ${activeLead?.firstname || 'this lead'}.` });
  }, [activeLeadId, activeLead]);

  if (!ready) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white/80 dark:border-sky-400/20 dark:bg-[#081522]/80" />
        <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white/80 dark:border-sky-400/20 dark:bg-[#081522]/80" />
      </div>
    );
  }


  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-sky-400/25 dark:bg-[#081522]/90">

        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-[#6B8CA5]">AI Email Writer</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"> <span>AI Email Intelligence Engine</span> <InfoTooltip title="AI Email Intelligence Engine" description="This AI workspace helps you generate personalized outbound emails for multiple leads using AI-driven context and smart personalization." /> </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-[#6B8CA5]">
          {selectedCount} selected leads from {fileName}. Configure once, generate a distinct email per lead, then refine and save individually.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-sky-400/20 dark:bg-[#081522] dark:shadow-none">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center text-[11px] font-medium text-slate-600 dark:text-[#6B8CA5]">
            Selected Leads
            <InfoTooltip
              title="Selected Leads"
              description="Preview and manage selected leads."
            />
          </p>

          <div className="flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm dark:border-sky-400/25 dark:bg-[#06111F]">
            <p className="text-xs font-medium text-slate-700 dark:text-[#D9F3FF]">{selectedCount} recipients</p>
          </div>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {selectedLeads.map((lead) => {
            const lid = stableLeadId(lead);
            const active = activeLeadId === lid;
            return (
              <button
                key={lid}
                type="button"
                onClick={() => {
                  setActiveLeadId(lid);
                  setGenerateError(null);
                  setIsOptimizerOpen(false);
                }}
                className={`min-w-[220px] rounded-xl border p-2.5 text-left transition ${active
                  ? 'border-sky-300 bg-sky-50 shadow-sm dark:border-[#00C8FF]/70 dark:bg-[#06111F] dark:shadow-[0_0_14px_rgba(0,200,255,0.25)]'
                  : 'border-slate-200 bg-white hover:border-sky-300 dark:border-[#38BDF8]/25 dark:bg-[#06111F]/60 dark:hover:border-[#38BDF8]/55'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-700 dark:bg-[#38BDF8]/25 dark:text-[#D8F5FF]">
                    {initials(displayName(lead))}
                  </span>
                  <p className="truncate text-xs font-medium text-slate-800 dark:text-white">{displayName(lead)}</p>
                </div>
                <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-[#6B8CA5]">{lead.company || 'Unknown company'}</p>
                <p className="truncate text-[11px] text-slate-500 dark:text-[#6B8CA5]">{lead.designation || 'Unknown role'}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 dark:border-[#38BDF8]/20 dark:bg-[#081522]/80">
          <h2 className="flex items-center text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-[#6B8CA5]">
            AI Configuration
            <InfoTooltip title="AI Configuration" description="Configure how the AI should write emails including offer details, tone, personalization depth, and messaging style." />
          </h2>
          <div>
            <label className="flex items-center text-xs text-slate-500 dark:text-[#6B8CA5]">
              What are we offering?
              <InfoTooltip title="What are we offering?" description="Describe your product, service, or offer clearly so AI can generate more relevant and persuasive emails." />
            </label>
            <textarea
              value={offer}
              onChange={(event) => setOffer(event.target.value)}
              rows={4}
              placeholder="What are we offering?"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 dark:border-[#38BDF8]/30 dark:bg-[#06111F] dark:text-slate-100 dark:focus:border-[#00C8FF] dark:focus:shadow-[0_0_0_1px_rgba(0,200,255,0.4),0_0_16px_rgba(0,200,255,0.25)]"
            />
          </div>
          <div>
            <p className="flex items-center text-xs text-slate-500 dark:text-[#6B8CA5]">
              Email Length
              <InfoTooltip title="Email Length" description="Choose how detailed the generated emails should be. Short emails are concise while long emails include more context and persuasion." />
            </p>
            <div className="mt-1.5 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-[#38BDF8]/20 dark:bg-[#06111F]/90">
              {(['short', 'medium', 'long'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmailLength(item)}
                  className={`rounded-lg px-3 py-2 text-xs capitalize transition ${emailLength === item
                    ? 'bg-sky-100 text-sky-700 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.55)] dark:bg-[#00C8FF]/20 dark:text-[#CCF5FF] dark:shadow-[inset_0_0_0_1px_rgba(0,200,255,0.6)]'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-[#6B8CA5] dark:hover:bg-[#081522]'
                    }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="flex items-center text-xs text-slate-800 dark:text-[#6B8CA5]">
              Personalize with
              <InfoTooltip title="Personalize with" description="Select which lead attributes AI should use while personalizing each email." />
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MERGE_TAG_KEYS.map((key) => {
                const active = personalize.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setPersonalize((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
                    }
                    className={`rounded-md border px-2.5 py-1 text-xs transition ${active
                      ? 'border-sky-300 bg-sky-100 text-sky-700 dark:border-[#00C8FF]/70 dark:bg-[#00C8FF]/15 dark:text-[#D5F5FF]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 dark:border-[#38BDF8]/30 dark:bg-[#06111F] dark:text-[#6B8CA5] dark:hover:border-[#38BDF8]/55'
                      }`}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="flex items-center text-xs text-slate-500 dark:text-[#6B8CA5]">
              Extra Instructions
              <InfoTooltip title="Extra Instructions" description="Add optional tone, CTA, writing style, or campaign-specific instructions for the AI." />
            </label>
            <textarea
              value={extraInstructions}
              onChange={(event) => setExtraInstructions(event.target.value)}
              rows={3}
              placeholder="Optional tone/style/CTA guidance…"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 dark:border-[#38BDF8]/30 dark:bg-[#06111F] dark:text-slate-100 dark:focus:border-[#00C8FF] dark:focus:shadow-[0_0_0_1px_rgba(0,200,255,0.4),0_0_16px_rgba(0,200,255,0.25)]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClearOfferFields}
              title="Clears the offer and extra instructions fields only"
              className="order-first rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-400/45 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
            >
              Clear
            </button>

            <button
              type="button"
              disabled={generating || !offer.trim()}
              onClick={() => void onGenerateCohort()}
              className="flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm transition hover:bg-sky-100 disabled:opacity-45 dark:border-[#00C8FF]/60 dark:bg-[#00C8FF]/15 dark:text-[#CCF5FF] dark:hover:bg-[#00C8FF]/25"
            >
              {generating ? 'Generating…' : 'Generate for Cohort'}
              <InfoTooltip description="Generate personalized emails for all selected leads using the current AI configuration." />
            </button>

            <button
              type="button"
              disabled={translating || !hasAnyGenerated || !activeSlot}
              onClick={() => void onTranslateActive()}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 shadow-sm transition hover:bg-cyan-100 disabled:opacity-45 dark:border-cyan-400/60 dark:bg-cyan-400/10 dark:text-cyan-100 dark:hover:bg-cyan-400/20"
            >
              {translating ? 'Translating…' : 'Translate to Arabic'}
              <InfoTooltip description="Translate the generated email into Arabic while preserving personalization and context." />
            </button>

            <button
              type="button"
              disabled={generating || !offer.trim() || !activeLeadId}
              onClick={() => setIsBenchmarkOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:opacity-45 dark:border-indigo-400/60 dark:bg-indigo-400/10 dark:text-indigo-100 dark:hover:bg-indigo-400/20"
            >
              Compare Models
              <InfoTooltip description="Compare multiple AI models on the current lead to find the best quality, speed, and tone." />
            </button>

          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 dark:border-[#38BDF8]/20 dark:bg-[#081522]/80">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-[#6B8CA5]">
              Generated Preview {activeLead ? `· ${displayName(activeLead)}` : ''}
              <InfoTooltip title="Generated Preview" description="Preview the generated email for the currently selected lead. You can refine, optimize, copy, and save it." />
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!displayed.subject}
                onClick={() => setIsOptimizerOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-300 px-2.5 py-1 text-xs text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-45 dark:border-[#38BDF8]/30 dark:text-[#BCEBFF] dark:hover:border-[#38BDF8]/60 dark:hover:bg-[#38BDF8]/10"
              >
                Rewrite
                <InfoTooltip description="Use AI to generate multiple improved versions of the current subject line." />
              </button>
              <button
                type="button"
                disabled={!displayed.subject && !displayed.bodyHtml}
                onClick={() => navigator.clipboard.writeText(`${displayed.subject}\n\n${htmlToText(displayed.bodyHtml)}`)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition hover:border-slate-400 disabled:opacity-45 dark:border-[#38BDF8]/30 dark:text-[#BCEBFF] dark:hover:border-[#38BDF8]/60"
              >
                Copy
              </button>
            </div>
          </div>

          {generating ? (
            <div className="space-y-2">
              <div className="h-5 animate-pulse rounded bg-[#06111F]" />
              <div className="h-40 animate-pulse rounded bg-[#06111F]" />
            </div>
          ) : (
            <div className="space-y-3" dir={displayed.rtl ? 'rtl' : 'ltr'}>
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-[#38BDF8]/20 dark:bg-[#06111F]/80">
                <p className="flex items-center text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-[#6B8CA5]">
                  Subject
                  <InfoTooltip title="Subject" description="This is the AI-generated email subject line. Strong subject lines improve open rates and reply chances." />
                </p>
                <p className={`mt-1 text-sm text-slate-900 dark:text-white ${displayed.rtl ? 'font-["Tahoma"] leading-8' : ''}`}>
                  {typedSubject}
                  {typedSubject.length < displayed.subject.length ? (
                    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[#00C8FF]" />
                  ) : null}
                </p>
              </div>

              {isOptimizerOpen && displayed.subject && activeLeadId ? (
                <SubjectOptimizer
                  initialSubject={displayed.subject}
                  leadContext={activeLeadContext}
                  offerContext={offer}
                  onClose={() => setIsOptimizerOpen(false)}
                  onSelect={(subject) => {
                    setLeadSlots((prev) => ({
                      ...prev,
                      [activeLeadId]: {
                        ...(prev[activeLeadId] ?? { subject: '', bodyHtml: '' }),
                        refinedSubject: subject,
                        arSubject: undefined,
                      },
                    }));
                    setIsOptimizerOpen(false);
                    setSaveFeedback({ type: 'success', message: 'Subject line updated.' });
                  }}
                />
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-[#38BDF8]/20 dark:bg-[#06111F]/80">
                <p className="flex items-center text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-[#6B8CA5]">
                  Email Body
                  <InfoTooltip title="Email Body" description="This is the generated personalized email body based on your selected lead and AI configuration." />
                </p>
                <pre
                  className={`mt-2 whitespace-pre-wrap text-sm text-slate-800 dark:text-[#E9F8FF] ${displayed.rtl ? 'font-["Tahoma"] leading-8' : 'leading-6'}`}
                >
                  {typedBody}
                  {typedBody.length < htmlToText(displayed.bodyHtml).length ? (
                    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[#00C8FF]" />
                  ) : null}
                </pre>
              </div>

              {displayed.reasoning && (
                <div className="rounded-xl border border-sky-200/30 bg-sky-500/5 p-3 dark:border-[#00C8FF]/20 dark:bg-[#00C8FF]/5">
                  <p className="flex items-center text-[10px] uppercase tracking-[0.2em] font-black text-sky-600 dark:text-[#00C8FF]/70 mb-2">
                    AI Intelligence Summary
                  </p>
                  <p className="text-xs text-slate-600 dark:text-[#BCEBFF] leading-relaxed italic">
                    "{displayed.reasoning}"
                  </p>
                </div>
              )}

              {displayed.analysis && (
                <div className="rounded-xl border border-emerald-200/30 bg-emerald-500/5 p-3 dark:border-emerald-400/20 dark:bg-emerald-400/5">
                  <p className="flex items-center text-[10px] uppercase tracking-[0.2em] font-black text-emerald-600 dark:text-emerald-400/70 mb-2">
                    Humanization Analysis
                  </p>
                  <p className="text-xs text-slate-600 dark:text-[#B4F3C8] leading-relaxed">
                    {displayed.analysis}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 space-y-2">
            <label className="flex items-center text-xs text-slate-500 dark:text-[#6B8CA5]" htmlFor="refine-prompt">
              Ask AI to refine this email
              <InfoTooltip title="Ask AI to refine this email" description="Give AI additional instructions to rewrite or improve the generated email." />
            </label>
            <textarea
              id="refine-prompt"
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              rows={2}
              disabled={!activeLeadId || refining}
              placeholder="Ask AI to refine this email…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 disabled:opacity-45 dark:border-[#38BDF8]/30 dark:bg-[#06111F] dark:text-slate-100 dark:focus:border-[#00C8FF]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={refining || !refineInput.trim() || !activeSlot || !englishBase(activeSlot).subject}
                onClick={() => void onRefineActive()}
                className="flex items-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-800 shadow-sm transition hover:bg-violet-100 disabled:opacity-45 dark:border-violet-400/50 dark:bg-violet-500/10 dark:text-violet-100 dark:hover:bg-violet-500/20"
              >
                {refining ? 'Refining…' : 'Apply refinement'}
                <InfoTooltip description="Apply your refinement instructions and regenerate the email using AI." />
              </button>
              <button
                type="button"
                disabled={savingLead || !activeLead || !displayed.subject.trim() || !displayed.bodyHtml.trim()}
                onClick={() => void onSaveActiveLead()}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-45 dark:border-emerald-400/60 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-500/20"
              >
                {savingLead ? 'Saving…' : 'Save'}
                <InfoTooltip description="Save the currently generated email and subject for this lead." />
              </button>
              {activeSlot?.lastSavedAt ? (
                <span className="text-[11px] text-slate-500 dark:text-[#6B8CA5]">
                  Last saved: {new Date(activeSlot.lastSavedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>

          {generateError ? (
            <p className="mt-3 rounded-lg border border-[#F59E0B]/45 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#FFD08A]">
              {generateError}
            </p>
          ) : null}
          {saveFeedback ? (
            <p
              className={`mt-3 rounded-lg border px-3 py-2 text-xs ${saveFeedback.type === 'error'
                ? 'border-[#F59E0B]/45 bg-[#F59E0B]/10 text-[#FFD08A]'
                : 'border-[#22C55E]/45 bg-[#22C55E]/10 text-[#B4F3C8]'
                }`}
            >
              {saveFeedback.message}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ScoreBar label={<span className="flex items-center gap-1">Personalization Score <InfoTooltip title="Personalization Score" description="Measures how deeply the email uses lead-specific information and personalization." /></span>} value={scores.personalization} tone="cyan" className="p-2" compact />
            <ScoreBar label={<span className="flex items-center gap-1">Cultural Fit <InfoTooltip title="Cultural Fit" description="Estimates how well the email tone and messaging align with the target audience and region." /></span>} value={scores.cultural} tone="emerald" className="p-2" compact />
            <ScoreBar label={<span className="flex items-center gap-1">Reply Likelihood <InfoTooltip title="Reply Likelihood" description="AI-estimated probability of getting a reply based on subject quality, tone, clarity, and personalization." /></span>} value={scores.reply} tone="amber" className="p-2" compact />
          </div>
        </div>
      </div>
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        leads={activeLead ? [activeLead] : []}
        aiConfig={{ offer, emailLength, personalizeWith: personalize, extraInstructions }}
        onSelectOutput={handleBenchmarkSelect}
      />
    </section>

  );
}
