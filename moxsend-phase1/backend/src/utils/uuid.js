/**
 * RFC 4122 string shape (any version). Good enough for route param validation.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 */
function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

module.exports = { isUuid };
