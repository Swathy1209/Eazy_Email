'use client';

import { useEffect, useMemo, useState } from 'react';

type ReplyStatus = 'Interested' | 'Maybe Later' | 'Not Interested' | 'Referral' | 'Pricing Question' | 'Meeting Request' | 'Out of Office' | 'Soft Decline';
type Sentiment = 'Positive' | 'Neutral' | 'Negative';

type InboxItem = {
  id: string;
  prospect: string;
  company: string;
  subject: string;
  preview: string;
  message: string;
  status: ReplyStatus;
  intentLabel: string;
  sentiment: Sentiment;
  urgency: 'Low' | 'Medium' | 'High';
  confidence: number;
  timestamp: string;
  unread: boolean;
  aiSort: 'High Intent' | 'Needs Nurture' | 'Auto Handle';
  recommendation: string;
  strategyForecast: string;
};

const INBOX_DATA: InboxItem[] = [
  {
    id: 'thread-1',
    prospect: 'Ahmed Al-Rashid',
    company: 'Najm Logistics Group',
    subject: 'Re: Warehouse automation pilots',
    preview: 'This looks interesting. Available Thursday afternoon?',
    message:
      'Hi team, this looks interesting for our Riyadh operations. We are evaluating vendors this month. Are you available Thursday after 2 PM to walk us through deployment timelines?',
    status: 'Meeting Request',
    intentLabel: 'Active Evaluation',
    sentiment: 'Positive',
    urgency: 'High',
    confidence: 94,
    timestamp: '2m ago',
    unread: true,
    aiSort: 'High Intent',
    recommendation: 'Book 30-min discovery call and share rollout plan.',
    strategyForecast: 'Likely to move to pilot discussion in 7-10 days.',
  },
  {
    id: 'thread-2',
    prospect: 'Priya Mehta',
    company: 'FluxBridge SaaS',
    subject: 'Re: outbound personalization workflow',
    preview: 'Can you send pricing details for 50 SDR seats?',
    message:
      'Thanks for sharing this, Priya here. Can you send pricing details for 50 SDR seats including annual commitment options and onboarding support?',
    status: 'Pricing Question',
    intentLabel: 'Commercial Review',
    sentiment: 'Positive',
    urgency: 'Medium',
    confidence: 91,
    timestamp: '12m ago',
    unread: true,
    aiSort: 'High Intent',
    recommendation: 'Send pricing matrix with 2 package options and ROI case.',
    strategyForecast: 'High chance of procurement handoff after pricing clarity.',
  },
  {
    id: 'thread-3',
    prospect: 'Khalid bin Saeed',
    company: 'Rimal Real Estate Holdings',
    subject: 'Re: campaign assistance',
    preview: 'We may revisit this next quarter.',
    message:
      'Appreciate the outreach. This is relevant but we may revisit this next quarter after budget approvals. Please reconnect around Q3.',
    status: 'Maybe Later',
    intentLabel: 'Timing Objection',
    sentiment: 'Neutral',
    urgency: 'Low',
    confidence: 92,
    timestamp: '26m ago',
    unread: false,
    aiSort: 'Needs Nurture',
    recommendation: 'Pause sequence for 90 days and schedule value-touch.',
    strategyForecast: 'Likely revisit opportunity in Q3 budget cycle.',
  },
  {
    id: 'thread-4',
    prospect: 'Rania Hassan',
    company: 'CrescentPay Fintech',
    subject: 'Re: AI follow-up assistant',
    preview: 'Not something we are prioritizing currently.',
    message:
      'Thanks Rania here. Not something we are prioritizing currently as our team is focused on fraud prevention roadmap. Happy to keep in touch for later.',
    status: 'Not Interested',
    intentLabel: 'Current Misalignment',
    sentiment: 'Negative',
    urgency: 'Low',
    confidence: 88,
    timestamp: '39m ago',
    unread: false,
    aiSort: 'Auto Handle',
    recommendation: 'Acknowledge and shift to low-frequency nurture list.',
    strategyForecast: 'Low near-term conversion, preserve relationship.',
  },
  {
    id: 'thread-5',
    prospect: 'Vikram Nair',
    company: 'Helios Enterprise Ops',
    subject: 'Re: outbound AI stack',
    preview: 'Please share with our RevOps head as well.',
    message:
      'Could you share this with our RevOps head too? I am looping in our team for feasibility. If possible include one enterprise case study from GCC clients.',
    status: 'Referral',
    intentLabel: 'Internal Forward',
    sentiment: 'Positive',
    urgency: 'Medium',
    confidence: 89,
    timestamp: '1h ago',
    unread: true,
    aiSort: 'Needs Nurture',
    recommendation: 'Respond with tailored deck and ask for stakeholder intro.',
    strategyForecast: 'Multi-threading possible across RevOps and Sales Ops.',
  },
  {
    id: 'thread-6',
    prospect: 'Sara Al-Mansoori',
    company: 'NoorChain Logistics',
    subject: 'Re: multilingual outbound assistant',
    preview: 'I am out this week, please follow up next Monday.',
    message:
      'Hi, currently out of office this week due to travel. Please follow up next Monday and include Arabic outreach examples if possible.',
    status: 'Out of Office',
    intentLabel: 'Deferred Response',
    sentiment: 'Neutral',
    urgency: 'Low',
    confidence: 84,
    timestamp: '2h ago',
    unread: false,
    aiSort: 'Auto Handle',
    recommendation: 'Queue follow-up for next Monday with localized examples.',
    strategyForecast: 'Re-engagement window opens after return.',
  },
];

const FILTERS = ['All', 'Unread', 'High Intent', 'Needs Nurture', 'Auto Handle'] as const;

function useTypewriter(value: string, speed: number, activeTrigger: string) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    setTyped('');
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setTyped(value.slice(0, i));
      if (i >= value.length) {
        window.clearInterval(timer);
      }
    }, speed);
    return () => window.clearInterval(timer);
  }, [value, speed, activeTrigger]);
  return typed;
}

function toneColor(sentiment: Sentiment): string {
  if (sentiment === 'Positive') return 'text-emerald-700 border-emerald-400/45 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10';
  if (sentiment === 'Negative') return 'text-rose-700 border-rose-400/45 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10';
  return 'text-amber-700 border-amber-400/45 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10';
}

function statusTone(status: ReplyStatus): string {
  if (status === 'Interested' || status === 'Meeting Request') return 'border-emerald-400/45 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  if (status === 'Maybe Later' || status === 'Pricing Question' || status === 'Out of Office') return 'border-amber-400/45 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200';
  if (status === 'Referral') return 'border-cyan-400/45 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200';
  return 'border-rose-400/45 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
}

function urgencyTone(urgency: InboxItem['urgency']): string {
  if (urgency === 'High') return 'text-rose-700 border-rose-400/45 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10';
  if (urgency === 'Medium') return 'text-amber-700 border-amber-400/45 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10';
  return 'text-cyan-700 border-cyan-400/45 bg-cyan-50 dark:text-cyan-300 dark:bg-cyan-500/10';
}

export default function ReplyIntelligencePage() {
  const [selectedId, setSelectedId] = useState(INBOX_DATA[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All');
  const [aiAnalyzing, setAiAnalyzing] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [regenerateKey, setRegenerateKey] = useState(0);

  const selectedThread = useMemo(
    () => INBOX_DATA.find((item) => item.id === selectedId) ?? INBOX_DATA[0],
    [selectedId],
  );

  const inboxRows = useMemo(() => {
    return INBOX_DATA.filter((item) => {
      const matchesQuery =
        !query.trim() ||
        `${item.prospect} ${item.company} ${item.subject} ${item.preview}`.toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (activeFilter === 'All') return true;
      if (activeFilter === 'Unread') return item.unread;
      return item.aiSort === activeFilter;
    });
  }, [activeFilter, query]);

  const unreadCount = useMemo(() => INBOX_DATA.filter((item) => item.unread).length, []);

  const generatedReply = useMemo(() => {
    const byStatus: Record<ReplyStatus, string> = {
      Interested: `Hi ${selectedThread.prospect.split(' ')[0]},\n\nGreat to hear the interest. I have attached a concise rollout blueprint for ${selectedThread.company}, including implementation milestones and owner mapping.\n\nWould Tuesday at 11:00 AM Gulf Standard Time work for a focused 25-minute session with your team?\n\nBest regards,\nMoxsend Team`,
      'Meeting Request': `Hi ${selectedThread.prospect.split(' ')[0]},\n\nPerfect, thanks for the quick reply. Thursday after 2 PM works on our side.\n\nI will share a calendar invite with a tailored agenda for ${selectedThread.company}, covering onboarding timeline, AI reply workflows, and expected lift in response rates.\n\nLooking forward to it.\n\nBest regards,\nMoxsend Team`,
      'Pricing Question': `Hi ${selectedThread.prospect.split(' ')[0]},\n\nAbsolutely. Sharing the pricing details for a 50-seat SDR deployment below, including annual commitment options, onboarding, and support tiers.\n\nI have also included a quick ROI calculator modeled for high-volume outbound teams, so your RevOps and finance stakeholders can review expected impact.\n\nIf useful, I can walk you through it live this week.\n\nBest regards,\nMoxsend Team`,
      'Maybe Later': `Hi ${selectedThread.prospect.split(' ')[0]},\n\nThank you for the context. That timeline makes sense.\n\nI will pause outreach for now and schedule a low-touch check-in aligned to your next quarter planning cycle. In the meantime, I can send one concise case study relevant to ${selectedThread.company} so you have it when priorities reopen.\n\nAppreciate the transparency.\n\nBest regards,\nMoxsend Team`,
      'Not Interested': `Hi ${selectedThread.prospect.split(' ')[0]},\n\nThanks for the candid update and for reviewing this.\n\nUnderstood on current priorities. I will close this thread for now and keep communication minimal. If helpful later, we can reconnect with a focused use case tied to your active roadmap.\n\nWishing your team continued success.\n\nBest regards,\nMoxsend Team`,
      Referral: `Hi ${selectedThread.prospect.split(' ')[0]},\n\nThank you, appreciated.\n\nI am sharing a concise overview deck and one GCC enterprise case study that should make internal review easier. If possible, please include your RevOps lead in the next thread and I can tailor the response to their KPIs.\n\nHappy to support your team.\n\nBest regards,\nMoxsend Team`,
      'Out of Office': `Hi ${selectedThread.prospect.split(' ')[0]},\n\nThanks for the note and safe travels.\n\nI will follow up next Monday with a concise summary and Arabic outreach examples as requested, so your team can evaluate quickly once you are back.\n\nBest regards,\nMoxsend Team`,
      'Soft Decline': `Hi ${selectedThread.prospect.split(' ')[0]},\n\nThanks for the update.\n\nUnderstood, and I appreciate the quick response. I will keep this in a light nurture state and share only relevant updates if priorities shift.\n\nBest regards,\nMoxsend Team`,
    };
    return byStatus[selectedThread.status];
  }, [selectedThread]);

  const typedReply = useTypewriter(generatedReply, 11, `${selectedThread.id}-${regenerateKey}`);

  useEffect(() => {
    setAiAnalyzing(true);
    setAnalysisStep(0);
    setCopied(false);
    const stepTimer = window.setInterval(() => {
      setAnalysisStep((prev) => {
        if (prev >= 3) return prev;
        return prev + 1;
      });
    }, 450);
    const doneTimer = window.setTimeout(() => setAiAnalyzing(false), 2100);
    return () => {
      window.clearInterval(stepTimer);
      window.clearTimeout(doneTimer);
    };
  }, [selectedThread.id, regenerateKey]);

  const analysisFeed = [
    'Positive curiosity detected from reply context.',
    'Timing objection identified with future budget signal.',
    'No strong rejection sentiment in language cues.',
    'Best move: acknowledge + maintain relationship momentum.',
  ];

  return (
    <section className="space-y-4 text-slate-900 dark:text-white">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-[#38BDF8]/30 dark:bg-[#06111F]/90 dark:shadow-[0_0_0_1px_rgba(56,189,248,0.16)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_52%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(0,200,255,0.20),transparent_52%)]" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-[#89A9C0]">Reply Intelligence OS</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">AI Reply Command Center</h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-[#8EA8BB]">
              Analyze prospect intent, generate contextual responses, and automate follow-up strategy with AI-native precision.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-sky-700 dark:border-[#38BDF8]/35 dark:bg-[#00C8FF]/10 dark:text-[#BDEEFF]">Neural Inbox Active</span>
            <span className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-[#A2BACD]">{INBOX_DATA.length} Replies</span>
            <span className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-[#A2BACD]">{unreadCount} Unread</span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-[#38BDF8]/22 dark:bg-[#081522]/90">
          <div className="mb-3 space-y-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#38BDF8]/25 dark:bg-[#020812]/80">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search replies, companies, intent..."
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-[#6F8EA7]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveFilter(chip)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] transition ${
                    activeFilter === chip
                      ? 'border-sky-300 bg-sky-100 text-sky-700 shadow-sm dark:border-[#00C8FF]/70 dark:bg-[#00C8FF]/14 dark:text-[#CFF4FF] dark:shadow-[0_0_16px_rgba(0,200,255,0.25)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50 dark:border-[#38BDF8]/25 dark:bg-[#06111F]/60 dark:text-[#87A3B9] dark:hover:border-[#38BDF8]/50 dark:hover:bg-[#081522]'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {inboxRows.map((item) => {
              const active = item.id === selectedThread.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`group w-full rounded-xl border p-3 text-left transition duration-300 ${
                    active
                      ? 'border-sky-300 bg-sky-50 shadow-sm dark:border-[#00C8FF]/75 dark:bg-[#06111F] dark:shadow-[0_0_0_1px_rgba(0,200,255,0.46),0_0_22px_rgba(0,200,255,0.24)]'
                      : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50 dark:border-[#38BDF8]/22 dark:bg-[#06111F]/65 dark:hover:border-[#38BDF8]/55 dark:hover:shadow-[0_0_20px_rgba(56,189,248,0.16)]'
                  } animate-fade-in`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.prospect}</p>
                    <span className="text-[11px] text-slate-500 dark:text-[#7C99AE]">{item.timestamp}</span>
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-[#7C99AE]">{item.company}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-700 dark:text-[#CFE7FA]">{item.subject}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-[#7D96AB]">{item.preview}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] ${statusTone(item.status)}`}>{item.status}</span>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-[#9DB7C9]">{item.intentLabel}</span>
                    <span className="rounded-md border border-cyan-400/35 bg-cyan-50 px-2 py-0.5 text-[10px] text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200">{item.aiSort}</span>
                    {item.unread ? <span className="h-2 w-2 animate-pulse rounded-full bg-[#00C8FF]" /> : null}
                  </div>
                </button>
              );
            })}
            {!inboxRows.length ? (
              <div className="rounded-xl border border-dashed border-[#38BDF8]/25 bg-[#06111F]/60 p-6 text-center text-xs text-[#7F9AB0]">
                No replies match current filters.
              </div>
            ) : null}
          </div>
        </aside>

        <main className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#38BDF8]/22 dark:bg-[#081522]/88">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#38BDF8]/22 dark:bg-[#06111F]/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-[#7EA0B8]">Conversation Intelligence</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                  {selectedThread.prospect} <span className="text-sm font-normal text-slate-500 dark:text-[#8EA8BB]">| {selectedThread.company}</span>
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-md border px-2.5 py-1 ${toneColor(selectedThread.sentiment)}`}>{selectedThread.sentiment} Sentiment</span>
                <span className={`rounded-md border px-2.5 py-1 ${urgencyTone(selectedThread.urgency)}`}>{selectedThread.urgency} Urgency</span>
                <span className="rounded-md border border-cyan-400/40 bg-cyan-50 px-2.5 py-1 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200">
                  Confidence {selectedThread.confidence}%
                </span>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#020812]/70">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-[#7EA0B8]">Original Reply</p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-[#D7EAF9]">{selectedThread.message}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[#9DB7C9]">Intent: {selectedThread.intentLabel}</span>
              <span className="rounded-md border border-[#38BDF8]/35 bg-[#38BDF8]/10 px-2 py-1 text-[#BEEFFF]">
                Recommended action: {selectedThread.recommendation}
              </span>
            </div>
          </section>

          <section className="grid gap-4 2xl:grid-cols-[1.1fr_1fr]">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#38BDF8]/25 dark:bg-[#06111F]/70">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-700/85 dark:text-cyan-300/85">AI Analysis Engine</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">Intent & Objection Breakdown</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/45 bg-cyan-50 px-2.5 py-1 text-[11px] text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                  {aiAnalyzing ? 'Analyzing Intent' : 'Analysis Complete'}
                </span>
              </div>
              <div className="space-y-2">
                {analysisFeed.map((insight, idx) => {
                  const active = analysisStep >= idx;
                  return (
                    <div
                      key={insight}
                      className={`rounded-lg border px-2.5 py-2 text-xs transition ${
                        active
                          ? 'border-cyan-400/40 bg-cyan-50 text-cyan-800 shadow-sm dark:bg-cyan-500/10 dark:text-cyan-100 dark:shadow-[0_0_18px_rgba(0,200,255,0.18)]'
                          : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-[#7B96AB]'
                      }`}
                    >
                      {active ? insight : 'Waiting for model signal...'}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/5">
                  <p className="text-slate-500 dark:text-[#7FA1B9]">Engagement Probability</p>
                  <p className="mt-1 text-lg font-semibold text-cyan-700 dark:text-cyan-200">{Math.min(98, selectedThread.confidence + 3)}%</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/5">
                  <p className="text-slate-500 dark:text-[#7FA1B9]">Buying Intent Strength</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                    {selectedThread.sentiment === 'Positive' ? 'Strong' : selectedThread.sentiment === 'Neutral' ? 'Moderate' : 'Low'}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#38BDF8]/25 dark:bg-[#06111F]/70">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-700/85 dark:text-cyan-300/85">AI Suggested Reply</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">Context-Aware Draft</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRegenerateKey((prev) => prev + 1)}
                  className="rounded-lg border border-cyan-400/40 bg-cyan-50 px-2.5 py-1 text-xs text-cyan-700 transition hover:bg-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20"
                >
                  Regenerate
                </button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#020812]/75">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700 dark:text-[#D9EDFC]">
                  {typedReply}
                  {typedReply.length < generatedReply.length ? <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-cyan-300" /> : null}
                </pre>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(generatedReply);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  }}
                  className="rounded-lg border border-cyan-400/45 bg-cyan-50 px-2.5 py-1.5 text-xs text-cyan-700 transition hover:bg-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/18"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition hover:border-cyan-400 hover:bg-sky-50 hover:text-sky-700 dark:border-white/20 dark:bg-white/5 dark:text-[#C2DAEC] dark:hover:border-cyan-400/40 dark:hover:text-cyan-100 dark:hover:bg-transparent"
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition hover:border-cyan-400 hover:bg-sky-50 hover:text-sky-700 dark:border-white/20 dark:bg-white/5 dark:text-[#C2DAEC] dark:hover:border-cyan-400/40 dark:hover:text-cyan-100 dark:hover:bg-transparent"
                >
                  Regenerate Variant
                </button>
                <button
                  type="button"
                  className="ml-auto rounded-lg border border-cyan-400/60 bg-cyan-100 px-3 py-1.5 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-200 dark:border-cyan-300/70 dark:bg-cyan-400/20 dark:text-cyan-100 dark:hover:bg-cyan-400/30 dark:hover:shadow-[0_0_20px_rgba(0,200,255,0.25)]"
                >
                  Send Reply
                </button>
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#38BDF8]/25 dark:bg-[#06111F]/70">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/85">AI Follow-Up Strategy</p>
                <h3 className="mt-1 text-base font-semibold text-white">Automation Flow Timeline</h3>
              </div>
              <span className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-[#A2BCCE]">{selectedThread.strategyForecast}</span>
            </div>
            <div className="relative overflow-x-auto pb-2">
              <div className="min-w-[780px]">
                <div className="relative mb-4 h-[2px] bg-slate-200 dark:bg-white/10">
                  <div className="absolute inset-y-0 left-0 w-[68%] animate-pulse bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 shadow-[0_0_16px_rgba(0,200,255,0.6)]" />
                </div>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {[
                    {
                      day: 'Day 0',
                      label: 'Reply Sent',
                      tone: 'border-cyan-400/60 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-100',
                    },
                    {
                      day: 'Day 7',
                      label: 'Engagement Check',
                      tone: 'border-cyan-400/40 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200',
                    },
                    {
                      day: 'Day 30',
                      label: 'Nudge Sequence',
                      tone: 'border-amber-400/45 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
                    },
                    {
                      day: 'Day 60',
                      label: 'AE Escalation',
                      tone: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-white/20 dark:bg-white/5 dark:text-[#C9DEEE]',
                    },
                    {
                      day: 'Day 90',
                      label: 'Re-engage',
                      tone: 'border-emerald-400/45 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
                    },
                  ].map((step, index) => (
                    <div key={step.day} className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-[#020812]/75">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${index < 2 ? 'animate-pulse bg-cyan-400 dark:bg-cyan-300' : 'bg-slate-300 dark:bg-white/30'}`} />
                        <p className="text-slate-500 dark:text-[#8CA8BE]">{step.day}</p>
                      </div>
                      <p className={`inline-flex rounded-md border px-2 py-0.5 ${step.tone}`}>{step.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
