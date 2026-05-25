const { randomUUID } = require('crypto');
const { buildSubjectLinePrompt } = require('./subjectLinePrompt');
const {
  sanitizeInput,
  normalizeSubjectLines,
  buildFallbackSubjectLines,
  ensureExactlyFive,
  buildEffectiveBrief,
} = require('./subjectLineShared');
const { runSubjectLineGeneration } = require('../services/subjectLineGeneration.service');

const DEFAULT_TONE = 'professional';
const cache = new Map();

async function generateSubjectLinesFromInput(input, runCtx, hooks) {
  const tone = sanitizeInput(input.tone || DEFAULT_TONE).toLowerCase() || DEFAULT_TONE;
  const effectiveBrief = buildEffectiveBrief(input);
  const cacheKey = `${tone}::${effectiveBrief}`;
  const traceId = runCtx?.traceId || randomUUID();
  const requestId = runCtx?.requestId || randomUUID();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    return {
      ...cached,
      meta: { ...cached.meta, traceId, requestId, cached: true },
    };
  }

  const prompt = buildSubjectLinePrompt({ brief: effectiveBrief, tone });

  const result = await runSubjectLineGeneration(
    { mode: 'brief', effectiveBrief, tone, prompt },
    {
      traceId,
      requestId,
      jobId: runCtx?.jobId,
      userId: runCtx?.userId,
      organizationId: runCtx?.organizationId,
      campaignId: runCtx?.campaignId,
    },
    hooks,
  );

  const out = {
    subjects: result.subjects,
    subjectLines: result.subjectLines,
    meta: { ...result.meta, traceId, requestId },
  };
  cache.set(cacheKey, out);
  return out;
}

function clearSubjectLineCache() {
  cache.clear();
}

module.exports = {
  DEFAULT_TONE,
  sanitizeInput,
  normalizeSubjectLines,
  ensureExactlyFive,
  buildFallbackSubjectLines,
  generateSubjectLinesFromInput,
  clearSubjectLineCache,
};
