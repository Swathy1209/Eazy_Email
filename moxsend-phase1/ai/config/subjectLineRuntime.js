/**
 * Environment-driven runtime for subject-line AI (timeouts, retries, feature flags).
 * @returns {import('./subjectLineRuntime.types').SubjectLineRuntimeConfig}
 */
function getSubjectLineRuntimeConfig() {
  const debugRaw =
    String(process.env.AI_DEBUG_LOG_RAW ?? '').trim() === '1' ||
    String(process.env.NODE_ENV ?? '').toLowerCase() === 'development';

  return {
    featureSubjectLines: String(process.env.AI_FEATURE_SUBJECT_LINES ?? '1').trim() !== '0',
    providerTimeoutMs: Math.max(1000, Number(process.env.AI_SUBJECT_TIMEOUT_MS ?? 8000) || 8000),
    maxGenerationAttempts: Math.max(1, Math.min(8, Number(process.env.AI_SUBJECT_MAX_ATTEMPTS ?? 3) || 3)),
    networkMaxAttempts: Math.max(1, Math.min(6, Number(process.env.AI_SUBJECT_NETWORK_RETRIES ?? 3) || 3)),
    retryBaseMs: Math.max(50, Number(process.env.AI_RETRY_BASE_MS ?? 250) || 250),
    retryMaxMs: Math.max(200, Number(process.env.AI_RETRY_MAX_MS ?? 8000) || 8000),
    maxSubjectLength: Math.max(20, Math.min(500, Number(process.env.AI_SUBJECT_MAX_LENGTH ?? 120) || 120)),
    expectedSubjectCount: Math.max(1, Math.min(20, Number(process.env.AI_SUBJECT_EXPECTED_COUNT ?? 5) || 5)),
    debugLogRawResponse: debugRaw && String(process.env.NODE_ENV ?? '').toLowerCase() !== 'production',
    environment: String(process.env.AI_LOG_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production'),
    estimatedCostPer1kTokensUsd: Number(process.env.AI_ESTIMATED_COST_PER_1K_TOKENS_USD ?? 0) || 0,
  };
}

module.exports = { getSubjectLineRuntimeConfig };
