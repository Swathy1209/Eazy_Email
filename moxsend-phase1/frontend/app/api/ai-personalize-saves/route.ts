import { getSupabaseAdmin, supabaseConfigHint } from '@/lib/supabase-admin';
import type { EmailLength } from '@/lib/email-personalize-types';
import type { MergeTagKey } from '@/lib/merge-tags';

export const runtime = 'nodejs';

const MAX_LIST = 80;

type PostBody = {
  importJobId?: string | null;
  referenceLeadEmail: string;
  referenceDisplay: string;
  selectedLeadCount: number;
  offer: string;
  extraInstructions?: string;
  emailLength: EmailLength;
  personalizeKeys: MergeTagKey[];
  abEnabled: boolean;
  subjectA: string;
  bodyHtmlA: string;
  subjectB?: string;
  bodyHtmlB?: string;
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  const configured = Boolean(supabase);
  if (!supabase) {
    return Response.json({ ok: true, configured: false, items: [] as unknown[] });
  }
  const { data, error } = await supabase
    .from('ai_personalize_generations')
    .select(
      'id, created_at, import_job_id, reference_lead_email, reference_display, selected_lead_count, offer, extra_instructions, email_length, personalize_keys, ab_enabled, subject_a, body_html_a, subject_b, body_html_b',
    )
    .order('created_at', { ascending: false })
    .limit(MAX_LIST);

  if (error) {
    return Response.json(
      { ok: false, configured: true, items: [] as unknown[], error: error.message },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, configured: true, items: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const hint = supabaseConfigHint() || 'Supabase not configured';
    return Response.json({ error: hint }, { status: 503 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const offer = String(body.offer ?? '').trim();
  const subjectA = String(body.subjectA ?? '').trim();
  const bodyHtmlA = String(body.bodyHtmlA ?? '').trim();
  const referenceLeadEmail = String(body.referenceLeadEmail ?? '').trim();
  const referenceDisplay = String(body.referenceDisplay ?? '').trim();

  if (!offer || !subjectA || !bodyHtmlA) {
    return Response.json({ error: 'offer, subjectA, and bodyHtmlA are required' }, { status: 400 });
  }

  const emailLength = body.emailLength;
  if (emailLength !== 'short' && emailLength !== 'medium' && emailLength !== 'long') {
    return Response.json({ error: 'emailLength invalid' }, { status: 400 });
  }

  const personalizeKeys = Array.isArray(body.personalizeKeys) ? body.personalizeKeys : [];
  const abEnabled = Boolean(body.abEnabled);
  const subjectB = body.subjectB?.trim() || null;
  const bodyHtmlB = body.bodyHtmlB?.trim() || null;

  const row = {
    import_job_id: body.importJobId ? String(body.importJobId) : null,
    reference_lead_email: referenceLeadEmail,
    reference_display: referenceDisplay,
    selected_lead_count: Math.max(0, Math.floor(Number(body.selectedLeadCount) || 0)),
    offer,
    extra_instructions: String(body.extraInstructions ?? ''),
    email_length: emailLength,
    personalize_keys: personalizeKeys,
    ab_enabled: abEnabled,
    subject_a: subjectA,
    body_html_a: bodyHtmlA,
    subject_b: abEnabled ? subjectB : null,
    body_html_b: abEnabled ? bodyHtmlB : null,
  };

  const { data, error } = await supabase.from('ai_personalize_generations').insert(row).select('id, created_at').single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, saved: data });
}
