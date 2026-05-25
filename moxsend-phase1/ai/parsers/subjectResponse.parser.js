/**
 * Normalize provider JSON into canonical internal subjects (text + score 0..1 + optional fields).
 * Accepts either `{ subjects: [{ text, score }] }` or legacy `{ subjectLines: [...] }`.
 *
 * @param {unknown} obj
 * @returns {import('./subjectResponse.types').NormalizedSubject[]}
 */
function parseSubjectResponseToNormalized(obj) {
  if (!obj || typeof obj !== 'object') {
    const err = new Error('INVALID_SUBJECT_PAYLOAD');
    err.code = 'INVALID_SUBJECT_PAYLOAD';
    throw err;
  }

  /** @type {import('./subjectResponse.types').NormalizedSubject[]} */
  const out = [];

  const record = /** @type {Record<string, unknown>} */ (obj);

  if (Array.isArray(record.subjects)) {
    for (const item of record.subjects) {
      if (!item || typeof item !== 'object') continue;
      const o = /** @type {Record<string, unknown>} */ (item);
      const text = String(o.text ?? '').trim();
      if (!text) continue;
      out.push({
        text,
        score: normalizeScore01(o.score),
        style: o.style != null ? String(o.style) : undefined,
        reason: o.reason != null ? String(o.reason) : undefined,
      });
    }
    return out;
  }

  if (Array.isArray(record.subjectLines)) {
    for (const item of record.subjectLines) {
      if (!item || typeof item !== 'object') continue;
      const o = /** @type {Record<string, unknown>} */ (item);
      const text = String(o.subject ?? o.text ?? '').trim();
      if (!text) continue;
      out.push({
        text,
        score: normalizeScore01(o.score),
        style: o.style != null ? String(o.style) : undefined,
        reason: o.reason != null ? String(o.reason) : undefined,
      });
    }
    return out;
  }

  const err = new Error('MISSING_SUBJECT_ARRAY');
  err.code = 'MISSING_SUBJECT_ARRAY';
  throw err;
}

/**
 * @param {unknown} score
 * @returns {number}
 */
function normalizeScore01(score) {
  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return 0.5;
  if (n > 1) {
    const scaled = n > 10 ? n / 100 : n / 10;
    return Math.min(1, Math.max(0, scaled));
  }
  return Math.min(1, Math.max(0, n));
}

module.exports = { parseSubjectResponseToNormalized };
