import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailLength } from '@/lib/email-personalize-types';
import type { MergeTagKey } from '@/lib/merge-tags';

export type AiPersonalizeUpsertPayload = {
  importJobId?: string | null;
  referenceLeadEmail: string;
  referenceDisplay: string;
  selectedLeadCount: number;
  offer: string;
  extraInstructions?: string;
  emailLength: EmailLength;
  personalizeKeys: MergeTagKey[];
  subjectA: string;
  bodyHtmlA: string;
};

export async function upsertAiPersonalizeGeneration(
  supabase: SupabaseClient,
  payload: AiPersonalizeUpsertPayload,
): Promise<{ id: string; created_at: string } | null> {
  const referenceLeadEmail = String(payload.referenceLeadEmail ?? '').trim();
  const subjectA = String(payload.subjectA ?? '').trim();
  const bodyHtmlA = String(payload.bodyHtmlA ?? '').trim();
  if (!referenceLeadEmail || !subjectA || !bodyHtmlA) return null;

  const row = {
    import_job_id: payload.importJobId ? String(payload.importJobId) : null,
    reference_lead_email: referenceLeadEmail,
    reference_display: String(payload.referenceDisplay ?? '').trim(),
    selected_lead_count: Math.max(0, Math.floor(Number(payload.selectedLeadCount) || 0)),
    offer: String(payload.offer ?? '').trim() || '(refined)',
    extra_instructions: String(payload.extraInstructions ?? ''),
    email_length: payload.emailLength,
    personalize_keys: payload.personalizeKeys,
    ab_enabled: false,
    subject_a: subjectA,
    body_html_a: bodyHtmlA,
    subject_b: null as string | null,
    body_html_b: null as string | null,
  };

  const { data: existing, error: selErr } = await supabase
    .from('ai_personalize_generations')
    .select('id')
    .eq('reference_lead_email', referenceLeadEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    throw new Error(selErr.message);
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('ai_personalize_generations')
      .update({
        import_job_id: row.import_job_id,
        reference_display: row.reference_display,
        selected_lead_count: row.selected_lead_count,
        offer: row.offer,
        extra_instructions: row.extra_instructions,
        email_length: row.email_length,
        personalize_keys: row.personalize_keys,
        subject_a: row.subject_a,
        body_html_a: row.body_html_a,
      })
      .eq('id', existing.id)
      .select('id, created_at')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase.from('ai_personalize_generations').insert(row).select('id, created_at').single();

  if (error) throw new Error(error.message);
  return data;
}
