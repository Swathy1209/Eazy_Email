import { getSupabaseAdmin, supabaseConfigHint } from '@/lib/supabase-admin';

/** Columns on public.ai_generation_logs — never insert secrets. */
const COLUMNS = new Set([
  'request_id',
  'trace_id',
  'job_id',
  'user_id',
  'organization_id',
  'campaign_id',
  'provider',
  'model',
  'event_type',
  'status',
  'input_payload',
  'validated_payload',
  'raw_response',
  'normalized_response',
  'validation_errors',
  'error_message',
  'error_stack',
  'retry_count',
  'retry_reason',
  'processing_time_ms',
  'token_input',
  'token_output',
  'estimated_cost',
  'row_index',
  'batch_size',
  'is_partial_failure',
  'is_timeout',
  'is_fallback_used',
  'environment',
]);

export type AiGenerationLogRow = Record<string, unknown>;

function buildInsertPayload(row: AiGenerationLogRow): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!COLUMNS.has(k)) continue;
    if (v === undefined) continue;
    filtered[k] = v;
  }
  return filtered;
}

/**
 * Best-effort insert; does not throw. Logs detailed errors in development.
 */
export async function persistAiGenerationLog(row: AiGenerationLogRow): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      const hint = supabaseConfigHint();
      if (process.env.NODE_ENV === 'development') {
        console.warn('[ai_generation_logs] Supabase admin client not configured.', hint || 'Set SUPABASE_SERVICE_ROLE_KEY + URL in .env.local');
      }
      return { ok: false, error: hint || 'Supabase not configured' };
    }
    const filtered = buildInsertPayload(row);
    if (!filtered.request_id || !filtered.event_type || !filtered.status) {
      return { ok: false, error: 'Missing request_id, event_type, or status' };
    }

    const { error } = await supabase.from('ai_generation_logs').insert(filtered);
    if (error) {
      const detail = [error.message, error.code, (error as { details?: string }).details, (error as { hint?: string }).hint]
        .filter(Boolean)
        .join(' | ');
      console.warn('[ai_generation_logs] insert failed:', detail);
      return { ok: false, error: detail };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'insert failed';
    console.warn('[ai_generation_logs]', msg);
    return { ok: false, error: msg };
  }
}

export function safeJsonbPreview(value: unknown, maxChars: number): unknown {
  if (value === null || value === undefined) return value;
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    if (s.length <= maxChars) return typeof value === 'string' ? value : JSON.parse(s);
    return { _truncated: true, preview: s.slice(0, maxChars) };
  } catch {
    return { _error: 'unserializable' };
  }
}

export type AiGenerationLogDbRow = {
  id: string;
  created_at: string;
  request_id: string;
  trace_id: string | null;
  job_id: string | null;
  event_type: string;
  status: string;
  provider: string | null;
  model: string | null;
  token_input: number | null;
  token_output: number | null;
  processing_time_ms: number | null;
  error_message: string | null;
  input_payload: unknown;
  validated_payload: unknown;
  retry_count: number | null;
};
