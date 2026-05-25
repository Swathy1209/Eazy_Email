/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {object} opts
 * @param {number} opts.maxAttempts
 * @param {number} opts.baseMs
 * @param {number} opts.maxDelayMs
 * @param {(err: unknown, attempt: number) => boolean} opts.shouldRetry
 * @param {(attempt: number, delayMs: number, err: unknown) => void} [opts.onRetry]
 * @returns {Promise<T>}
 */
async function withRetry(fn, opts) {
  const { maxAttempts, baseMs, maxDelayMs, shouldRetry, onRetry } = opts;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const nextAttempt = attempt + 1;
      if (nextAttempt >= maxAttempts || !shouldRetry(err, nextAttempt)) {
        throw err;
      }
      const exp = Math.min(maxDelayMs, baseMs * 2 ** attempt);
      if (onRetry) onRetry(nextAttempt, exp, err);
      // eslint-disable-next-line no-await-in-loop
      await sleep(exp);
    }
  }
  throw lastErr;
}

module.exports = { withRetry, sleep };
