import type { EmailLength } from '../shared/email-personalize-types';
import type { MergeTagKey } from '../shared/merge-tags';
import { rowToMergeValues } from '../shared/merge-tags';
import type { RowResult } from '../shared/lead-types';

export type PersonalizeEmailPromptParams = {
  offer: string;
  length: EmailLength;
  personalizeKeys: MergeTagKey[];
  extraInstructions?: string;
  sampleRow: RowResult;
  variantLabel: 'A' | 'B';
  cohortRows?: RowResult[];
};

function lengthGuidance(len: EmailLength): string {
  switch (len) {
    case 'short':
      return 'Body: 2–3 short <p> paragraphs.';
    case 'medium':
      return 'Body: 3–4 <p> paragraphs.';
    case 'long':
      return 'Body: 5–7 short <p> paragraphs.';
    default:
      return '';
  }
}

function cohortSummaryLines(rows: RowResult[]): string {
  return rows
    .map((row, i) => {
      const v = rowToMergeValues(row);
      const parts = [
        v.name,
        v.company && `@ ${v.company}`,
        v.industry && `(${v.industry})`,
        [v.city, v.region].filter(Boolean).join(', '),
      ].filter(Boolean);
      return `${i + 1}. ${parts.join(' ')}`.trim();
    })
    .join('\n');
}

const FORBIDDEN_PHRASES = [
  'accelerate growth',
  'maximize efficiency',
  'streamline operations',
  'innovative solution',
  'cutting-edge',
  'seamless experience',
  'boost productivity',
  'transform your business',
  'AI-powered',
  'operational excellence',
  'stakeholder alignment',
  'workflow optimization',
  'We provide...',
  'You can leverage...',
];

/** B2B outbound JSON: subject, HTML body, and scoring fields (matches personalize-email API). */
export function buildPersonalizeEmailPrompt(params: PersonalizeEmailPromptParams): string {
  const { offer, length, personalizeKeys, extraInstructions, sampleRow, variantLabel, cohortRows } = params;
  const resolved = rowToMergeValues(sampleRow);
  const audienceLines = [
    `Name: ${resolved.name}`,
    `Company: ${resolved.company || '—'}`,
    `Industry: ${resolved.industry || '—'}`,
    `Role/title: ${resolved.role || '—'}`,
    `City: ${resolved.city || '—'}`,
    `Region/country: ${resolved.region || '—'}`,
    `Website: ${resolved.website || '—'}`,
  ].join('\n');

  const cohortBlock =
    cohortRows && cohortRows.length > 1
      ? `\nCohort (${cohortRows.length} contacts). ONE reusable email; merge tags at send — not separate emails per person:\n${cohortSummaryLines(cohortRows)}\n`
      : '';

  const tagList = personalizeKeys.map((k) => `{{${k}}}`).join(', ');
  const variantNote =
    variantLabel === 'A'
      ? 'Variant A: observational; diagnose an operational bottleneck.'
      : 'Variant B: stress hidden business consequence / revenue leak; different hook than A.';

  const instr = (extraInstructions ?? '').trim();
  const extra = instr ? `User add-ons (follow):\n${instr}` : '';

  return `You are a sharp B2B outbound operator — not SaaS marketing copy.

${variantNote}

ANTI-TEMPLATE & VOICE:
- Implied context, no robotic personalization ("As a {{role}} at {{company}}").
- CONCRETE: "requests and approvals" over "operational complexity".
- OBSERVATIONAL: Sound human. "Things start slowing down...".
- NO JARGON: Also avoid these phrases: ${FORBIDDEN_PHRASES.join(', ')}.

Offer:
${offer}

Audience (ops reality):
${audienceLines}
${cohortBlock}

Merge tags — ONLY: ${tagList}. No other {{...}}.

Rules:
- Greeting: "Hi {{name}}," or "Hey {{name}},".
- Open on workflow friction; ~60% diagnosis, <35% product. Peer tone, short sentences.
- No brochure tone. No robotic "As a {{role}} at {{company}}...".
- Forbidden: demo/call booking CTAs ("Book a demo", "Schedule a call", "15-minute chat", "Would you be open to").
- Soft CTAs only, e.g. "Could be relevant depending on how {{company}} handles…".
- Avoid SaaS buzzwords (streamline, synergy, leverage, cutting-edge, AI-powered, optimize workflows, maximize efficiency, transform, seamless, empower, unlock growth, innovative platform, operational excellence).
- Para 3: calm ops transition ("Some teams connect X to Y…") — no feature dumps.

Structure — exactly 4 <p> paragraphs in the HTML body:
1) Specific bottleneck (1–2 sentences).
2) Business consequence (1–2 sentences).
3) Practical outcome + calm product bridge (1–2 sentences).
4) One soft CTA sentence.

${lengthGuidance(length)}

Subject (≤10 words, no Title Case):
- Include ≥1 allowed merge tag (prefer {{name}} or {{company}}).
- Must echo the concrete bottleneck in paragraph 1 — not "[industry] + follow-ups" or generic "quick idea".
- Avoid vague abstractions: optimization, friction, efficiency.

GCC LOCALIZATION: If UAE, tone is agile/scaling. If Saudi Arabia, tone is enterprise/compliance. IMPORTANT: ALWAYS WRITE IN ENGLISH unless the extra instructions explicitly request Arabic.

Self-check (fix before output): AI/marketing voice? Vague subject? Buzzwords? If yes, rewrite shorter and more concrete.

Output: ONLY JSON, no markdown. Use exactly these keys:
- "subject": string (subject line)
- "body": string — HTML fragment only: <p> and <br> allowed, no <html> wrapper
- "personalization_score": number 0–100
- "cultural_fit_score": number 0–100
- "reply_likelihood_score": number 0–100
- "language_mode": string (e.g. "en")
- "reasoning_summary": string (1–2 short sentences)
${extra ? `\n${extra}\n` : ''}
Return the JSON now.`;
}
