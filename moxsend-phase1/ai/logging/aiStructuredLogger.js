const { AI_EVENT_TYPES } = require('../constants/aiEvents');

const SENSITIVE_KEYS = new Set([
  'authorization',
  'apikey',
  'api_key',
  'password',
  'token',
  'secret',
  'service_role',
  'supabase_key',
]);

/**
 * @param {Record<string, unknown>} meta
 * @param {boolean} production
 */
function redactMeta(meta, production) {
  if (!production) return meta;
  const out = { ...meta };
  for (const k of Object.keys(out)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    }
  }
  if (typeof out.rawResponsePreview === 'string' && out.rawResponsePreview.length > 200) {
    out.rawResponsePreview = `${out.rawResponsePreview.slice(0, 200)}…`;
  }
  return out;
}

/**
 * @param {object} params
 * @param {string} params.scope
 * @param {string} params.eventType
 * @param {string} params.status
 * @param {string} params.traceId
 * @param {string} [params.requestId]
 * @param {string} [params.jobId]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {number} [params.processingTimeMs]
 * @param {number} [params.retryCount]
 * @param {string} [params.retryReason]
 * @param {boolean} [params.isProduction]
 * @param {Record<string, unknown>} [params.extra]
 */
function logAiEvent(params) {
  const production = params.isProduction !== false;
  const payload = {
    ts: new Date().toISOString(),
    scope: 'ai',
    eventType: params.eventType,
    status: params.status,
    traceId: params.traceId,
    requestId: params.requestId,
    jobId: params.jobId,
    provider: params.provider,
    model: params.model,
    processingTimeMs: params.processingTimeMs,
    retryCount: params.retryCount,
    retryReason: params.retryReason,
    ...(params.extra ? redactMeta(params.extra, production) : {}),
  };
  const line = JSON.stringify(payload);
  if (params.eventType === AI_EVENT_TYPES.GENERATION_FAILED || params.status === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

module.exports = {
  AI_EVENT_TYPES,
  logAiEvent,
  redactMeta,
};
