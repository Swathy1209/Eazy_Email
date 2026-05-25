import { getSupabaseAdmin, supabaseConfigHint } from '@/lib/supabase-admin';
import type { AiGenerationLogDbRow } from '@/lib/ai-generation-log';

export const runtime = 'nodejs';

const MAX = 80;

const UI_EVENT_TYPES = [
  'GENERATION_COMPLETED',
  'GENERATION_FAILED',
  'INVALID_OUTPUT',
  'TIMEOUT_OCCURRED',
  'VALIDATION_FAILED',
  'RETRY_TRIGGERED',
  'REQUEST_RECEIVED',
];

/**
 * List recent AI generation logs (optional filter by import job id).
 */
export async function GET(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({
      ok: true,
      configured: false,
      hint: supabaseConfigHint() || undefined,
      items: [] as AiGenerationLogDbRow[],
    });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('job_id')?.trim();
  const limit = Math.min(MAX, Math.max(1, Number(searchParams.get('limit')) || 40));

  let q = supabase
    .from('ai_generation_logs')
    .select(
      'id, created_at, request_id, trace_id, job_id, event_type, status, provider, model, token_input, token_output, processing_time_ms, error_message, input_payload, validated_payload, retry_count',
    )
    .in('event_type', UI_EVENT_TYPES)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (jobId) {
    q = q.eq('job_id', jobId);
  } else {
    q = q.is('job_id', null);
  }

  const { data, error } = await q;

  if (error) {
    console.warn('[ai_generation_logs] query failed:', error.message, error.code, error.details);
    return Response.json(
      {
        ok: false,
        configured: true,
        error: error.message,
        hint: error.code === 'PGRST205' ? 'Table ai_generation_logs may be missing in Supabase.' : undefined,
        items: [] as AiGenerationLogDbRow[],
      },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    configured: true,
    items: (data ?? []) as AiGenerationLogDbRow[],
  });
}
