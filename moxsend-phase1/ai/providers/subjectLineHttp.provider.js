const { withRetry } = require('../retries/withRetry');

/**
 * @typedef {object} HttpSubjectProviderResult
 * @property {boolean} ok
 * @property {string} [rawText]
 * @property {number} [statusCode]
 * @property {string} [errorCode]
 * @property {string} [provider]
 * @property {boolean} [skipped]
 */

/**
 * @param {unknown} err
 */
function isRetryableHttpError(err) {
  if (!err || typeof err !== 'object') return false;
  const code = /** @type {{ code?: string, statusCode?: number }} */ (err).code;
  const status = /** @type {{ statusCode?: number }} */ (err).statusCode;
  if (code === 'FETCH_NETWORK' || code === 'AI_TIMEOUT') return true;
  if (typeof status === 'number' && (status >= 500 || status === 429)) return true;
  return false;
}

/**
 * @param {string} prompt
 * @param {object} opts
 * @param {number} opts.timeoutMs
 * @param {number} opts.networkMaxAttempts
 * @param {number} opts.retryBaseMs
 * @param {number} opts.retryMaxMs
 * @returns {Promise<HttpSubjectProviderResult>}
 */
async function fetchSubjectLineJson(prompt, opts) {
  const endpoint = process.env.SUBJECT_AI_ENDPOINT?.trim();
  const apiKey = process.env.SUBJECT_AI_API_KEY?.trim();

  if (!endpoint) {
    return { ok: false, skipped: true, errorCode: 'PROVIDER_NOT_CONFIGURED', provider: 'http' };
  }

  const runOnce = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      const rawText = await res.text();
      if (!res.ok) {
        const err = new Error(`AI provider failed (${res.status})`);
        err.code = 'PROVIDER_HTTP_ERROR';
        err.statusCode = res.status;
        throw err;
      }
      return { rawText, statusCode: res.status };
    } catch (e) {
      if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') {
        const err = new Error('AI_TIMEOUT');
        err.code = 'AI_TIMEOUT';
        throw err;
      }
      if (e && typeof e === 'object' && 'code' in e && e.code === 'PROVIDER_HTTP_ERROR') {
        throw e;
      }
      const err = new Error('FETCH_NETWORK');
      err.code = 'FETCH_NETWORK';
      err.cause = e;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const result = await withRetry(runOnce, {
      maxAttempts: opts.networkMaxAttempts,
      baseMs: opts.retryBaseMs,
      maxDelayMs: opts.retryMaxMs,
      shouldRetry: (err, attempt) => isRetryableHttpError(err) && attempt < opts.networkMaxAttempts,
    });
    return {
      ok: true,
      rawText: result.rawText,
      statusCode: result.statusCode,
      provider: 'http',
    };
  } catch (err) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err ? Number(err.statusCode) : undefined;
    const code =
      err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
        ? err.code
        : 'PROVIDER_FAILED';
    return { ok: false, errorCode: code, statusCode, provider: 'http' };
  }
}

module.exports = {
  fetchSubjectLineJson,
  isRetryableHttpError,
};
