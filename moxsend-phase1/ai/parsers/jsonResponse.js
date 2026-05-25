/**
 * Parse model output that may include markdown fences or trailing junk.
 * @param {unknown} raw
 * @returns {unknown}
 */
function parseJsonLoose(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    const err = new Error('EMPTY_PROVIDER_BODY');
    err.code = 'EMPTY_PROVIDER_BODY';
    throw err;
  }
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const cleaned = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    const err = new Error('INVALID_JSON');
    err.code = 'INVALID_JSON';
    throw err;
  }
}

module.exports = { parseJsonLoose };
