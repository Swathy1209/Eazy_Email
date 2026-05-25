/**
 * Minimal structured logging (swap for pino/winston later without touching call sites).
 */

function ts() {
  return new Date().toISOString();
}

/**
 * @param {string} scope
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function info(scope, message, meta) {
  const line = `[${ts()}] [INFO] [${scope}] ${message}`;
  // eslint-disable-next-line no-console
  console.log(meta && Object.keys(meta).length ? `${line} ${JSON.stringify(meta)}` : line);
}

/**
 * @param {string} scope
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function warn(scope, message, meta) {
  const line = `[${ts()}] [WARN] [${scope}] ${message}`;
  // eslint-disable-next-line no-console
  console.warn(meta && Object.keys(meta).length ? `${line} ${JSON.stringify(meta)}` : line);
}

/**
 * @param {string} scope
 * @param {string} message
 * @param {unknown} [err]
 */
function error(scope, message, err) {
  // eslint-disable-next-line no-console
  console.error(`[${ts()}] [ERROR] [${scope}] ${message}`, err ?? '');
}

module.exports = {
  info,
  warn,
  error,
};
