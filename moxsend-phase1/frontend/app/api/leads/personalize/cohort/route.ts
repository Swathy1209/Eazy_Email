import { randomUUID } from 'crypto';
import { POST as personalizeEmailPost } from '@/app/api/gemini/personalize-email/route';
import { getSupabaseAdmin, supabaseConfigHint } from '@/lib/supabase-admin';
import type { EmailLength } from '@/lib/email-personalize-types';
import type { RowResult } from '@/lib/lead-types';
import { stableLeadId } from '@/lib/lead-id';
import type { MergeTagKey } from '@/lib/merge-tags';
import { MERGE_TAG_KEYS } from '@/lib/merge-tags';
import { upsertAiPersonalizeGeneration } from '@/lib/ai-personalize-upsert';

export const runtime = 'nodejs';

const MAX_COHORT = 50;

function isMergeTagKey(k: string): k is MergeTagKey {
  return (MERGE_TAG_KEYS as readonly string[]).includes(k);
}

function displayName(lead: RowResult): string {
  const fromNames = `${lead.firstname} ${lead.lastname}`.trim();
  return lead.name || fromNames || lead.email || 'Unknown';
}

function ensureEmailClosing(bodyHtml: string): string {
  const closingPattern =
    /(yours sincerely|sincerely|best regards|kind regards|warm regards|regards|yours truly|thank you|thanks)[\s\S]*$/i;
  const plain = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  if (closingPattern.test(plain)) return bodyHtml;
  const closingHtml = '<p>Yours sincerely,<br/>Moxsend Team</p>';
  return `${bodyHtml.trim()}${bodyHtml.trim() ? '\n' : ''}${closingHtml}`;
}

function packEmail(subject: string, bodyHtml: string): string {
  return JSON.stringify({ subject, bodyHtml });
}

type AiConfig = {
  offer: string;
  emailLength: EmailLength;
  personalizeWith: string[];
  extraInstructions?: string;
};

type Body = {
  leadIds: string[];
  aiConfig: AiConfig;
  /** Required for generation; aligned with leadIds (same length, same order). */
  leadRecords: RowResult[];
  importJobId?: string | null;
};

function campaignStorageKey(campaignId: string): string {
  return `campaign:${campaignId}`;
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    // eslint-disable-next-line no-await-in-loop
    const chunk = await Promise.all(slice.map((item, j) => fn(item, i + j)));
    for (let j = 0; j < chunk.length; j += 1) {
      results[i + j] = chunk[j];
    }
  }
  return results;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const leadIds = Array.isArray(body.leadIds) ? body.leadIds.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
  const records = Array.isArray(body.leadRecords) ? body.leadRecords : [];

  if (!leadIds.length) {
    return Response.json({ success: false, error: 'leadIds required' }, { status: 400 });
  }
  if (records.length !== leadIds.length) {
    return Response.json({ success: false, error: 'leadRecords must match leadIds length' }, { status: 400 });
  }

  for (let i = 0; i < leadIds.length; i += 1) {
    if (stableLeadId(records[i]) !== leadIds[i]) {
      return Response.json({ success: false, error: `leadIds[${i}] does not match leadRecords[${i}]` }, { status: 400 });
    }
  }

  if (leadIds.length > MAX_COHORT) {
    return Response.json({ success: false, error: `Maximum ${MAX_COHORT} leads per cohort` }, { status: 400 });
  }

  const cfg = body.aiConfig;
  const offer = String(cfg?.offer ?? '').trim();
  if (!offer) {
    return Response.json({ success: false, error: 'aiConfig.offer is required' }, { status: 400 });
  }

  const emailLength = cfg?.emailLength;
  if (emailLength !== 'short' && emailLength !== 'medium' && emailLength !== 'long') {
    return Response.json({ success: false, error: 'aiConfig.emailLength invalid' }, { status: 400 });
  }

  const pw = Array.isArray(cfg?.personalizeWith) ? cfg.personalizeWith : [];
  const personalizeKeys = pw.filter((x): x is MergeTagKey => typeof x === 'string' && isMergeTagKey(x));
  if (!personalizeKeys.length) {
    return Response.json({ success: false, error: 'aiConfig.personalizeWith must include valid merge-tag keys' }, { status: 400 });
  }

  const extraInstructions = String(cfg?.extraInstructions ?? '');
  const importJobId = body.importJobId != null ? String(body.importJobId).trim() || null : null;
  const campaignId = importJobId ?? randomUUID();

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const hint = supabaseConfigHint() || 'Supabase not configured';
    return Response.json({ success: false, error: hint }, { status: 503 });
  }

  try {
    const internalApiOrigin = (process.env.INTERNAL_API_ORIGIN ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
    
    // Request a single common base email from the Express orchestrator
    const orchestratorRes = await fetch(`${internalApiOrigin}/api/ai/cohort-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        leads: records,
        aiConfig: { offer, emailLength, personalizeWith: personalizeKeys, extraInstructions }
      }),
    });

    const orchestratorData = await orchestratorRes.json();
    if (!orchestratorRes.ok || !orchestratorData.success) {
      // Express error handler sends { success: false, error: { message, code } }
      const errMsg =
        (typeof orchestratorData.error === 'object'
          ? orchestratorData.error?.message
          : orchestratorData.error) ||
        orchestratorData.message ||
        'Cohort generation failed from backend';
      throw new Error(errMsg);
    }

    console.log('[DEBUG] cohort route orchestratorData:', JSON.stringify(orchestratorData).slice(0, 500));
    
    const emailData = orchestratorData.email || {};
    const subject = String(emailData.subject || '').trim();
    const bodyHtml = String(emailData.bodyHtml || '').trim();

    if (!subject || !bodyHtml) {
      throw new Error('Received empty subject or body from backend');
    }

    const finalizedBodyHtml = ensureEmailClosing(bodyHtml);
    const packed = packEmail(subject, finalizedBodyHtml);

    // Persist ONE campaign-level base email (source of truth).
    await upsertAiPersonalizeGeneration(supabase, {
      importJobId: campaignId,
      referenceLeadEmail: campaignStorageKey(campaignId),
      referenceDisplay: `Campaign ${campaignId} · ${leadIds.length} leads`,
      selectedLeadCount: leadIds.length,
      offer,
      extraInstructions,
      emailLength,
      personalizeKeys,
      subjectA: subject,
      bodyHtmlA: finalizedBodyHtml,
    });

    // Provide the same common email for all requested leads (no per-lead persistence here).
    const emails = records.map((_lead, idx) => ({ leadId: leadIds[idx], email: packed }));

    return Response.json({ success: true, campaignId, emails });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Cohort generation failed';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
