const { getSupabaseAdmin } = require('./supabase.service');

const LOG_COLUMNS = new Set([
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

/**
 * Best-effort persistence for ai_generation_logs. Never throws to callers.
 * @param {Record<string, unknown>} row
 */
async function persistAiGenerationLog(row) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    /** @type {Record<string, unknown>} */
    const filtered = {};
    for (const [k, v] of Object.entries(row)) {
      if (LOG_COLUMNS.has(k)) filtered[k] = v;
    }
    if (!filtered.request_id || !filtered.event_type || !filtered.status) {
      return;
    }
    const { error } = await supabase.from('ai_generation_logs').insert(filtered);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[ai_generation_logs] insert skipped:', error.code || error.message);
    }
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[ai_generation_logs] insert failed');
  }
}

module.exports = { persistAiGenerationLog };
