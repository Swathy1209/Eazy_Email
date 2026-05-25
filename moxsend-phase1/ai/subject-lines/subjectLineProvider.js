/**
 * @deprecated Use ai/parsers/jsonResponse and ai/providers/subjectLineHttp.provider instead.
 * Kept for backward-compatible requires.
 */
const { parseJsonLoose } = require('../parsers/jsonResponse');
const { fetchSubjectLineJson } = require('../providers/subjectLineHttp.provider');
const { getSubjectLineRuntimeConfig } = require('../config/subjectLineRuntime');

async function generateSubjectLinesPayload(prompt, fallbackPayload) {
  const config = getSubjectLineRuntimeConfig();
  const res = await fetchSubjectLineJson(prompt, {
    timeoutMs: config.providerTimeoutMs,
    networkMaxAttempts: config.networkMaxAttempts,
    retryBaseMs: config.retryBaseMs,
    retryMaxMs: config.retryMaxMs,
  });
  if (!res.ok || !res.rawText) {
    return fallbackPayload;
  }
  try {
    return parseJsonLoose(res.rawText);
  } catch {
    return fallbackPayload;
  }
}

module.exports = {
  parseJsonLoose,
  generateSubjectLinesPayload,
};
