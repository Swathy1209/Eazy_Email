import { getSupabaseAdmin, supabaseConfigHint } from '@/lib/supabase-admin';
import type { EmailLength } from '@/lib/email-personalize-types';
import type { MergeTagKey } from '@/lib/merge-tags';
import { MERGE_TAG_KEYS } from '@/lib/merge-tags';
import { upsertAiPersonalizeGeneration } from '@/lib/ai-personalize-upsert';

export const runtime = 'nodejs';

function isMergeTagKey(k: string): k is MergeTagKey {
  return (MERGE_TAG_KEYS as readonly string[]).includes(k);
}

type Body = {
  leadId: string;
  /** Recipient address — upsert key in ai_personalize_generations.reference_lead_email */
  recipientEmail: string;
  referenceDisplay: string;
  selectedLeadCount: number;
  offer: string;
  extraInstructions?: string;
  emailLength: EmailLength;
  personalizeWith: MergeTagKey[];
  subject: string;
  bodyHtml: string;
  importJobId?: string | null;
};

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const hint = supabaseConfigHint() || 'Supabase not configured';
    return Response.json({ success: false, error: hint }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const leadId = String(body.leadId ?? '').trim();
  const recipientEmail = String(body.recipientEmail ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const bodyHtml = String(body.bodyHtml ?? '').trim();
  const referenceDisplay = String(body.referenceDisplay ?? '').trim();

  if (!leadId || !recipientEmail) {
    return Response.json({ success: false, error: 'leadId and recipientEmail are required' }, { status: 400 });
  }
  if (!subject || !bodyHtml) {
    return Response.json({ success: false, error: 'subject and bodyHtml are required' }, { status: 400 });
  }

  const emailLength = body.emailLength;
  if (emailLength !== 'short' && emailLength !== 'medium' && emailLength !== 'long') {
    return Response.json({ success: false, error: 'emailLength invalid' }, { status: 400 });
  }

  const keys = Array.isArray(body.personalizeWith) ? body.personalizeWith : [];
  const personalizeKeys = keys.filter((x): x is MergeTagKey => typeof x === 'string' && isMergeTagKey(x));
  if (!personalizeKeys.length) {
    return Response.json({ success: false, error: 'personalizeWith must include valid keys' }, { status: 400 });
  }

  const offer = String(body.offer ?? '').trim();
  if (!offer) {
    return Response.json({ success: false, error: 'offer is required' }, { status: 400 });
  }

  try {
    const campaignKey = body.importJobId != null ? String(body.importJobId).trim() || null : null;
    const storageKey = campaignKey ? `campaign:${campaignKey}:lead:${leadId}` : recipientEmail;

    const saved = await upsertAiPersonalizeGeneration(supabase, {
      importJobId: body.importJobId != null ? String(body.importJobId).trim() || null : null,
      referenceLeadEmail: storageKey,
      referenceDisplay,
      selectedLeadCount: Math.max(0, Math.floor(Number(body.selectedLeadCount) || 0)),
      offer,
      extraInstructions: String(body.extraInstructions ?? ''),
      emailLength,
      personalizeKeys,
      subjectA: subject,
      bodyHtmlA: bodyHtml,
    });

    return Response.json({
      success: true,
      savedAt: saved?.created_at ?? new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Save failed';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
