const { validateMergeTagsInText } = require('./mergeTags');

/** Minimal blocklist — extend or plug enterprise list later. */
const PROFANITY = /\b(fuck|shit|damn)\b/i;

/**
 * @typedef {object} NormalizedSubject
 * @property {string} text
 * @property {number} score
 * @property {string} [style]
 * @property {string} [reason]
 */

/**
 * @param {NormalizedSubject[]} subjects
 * @param {object} opts
 * @param {number} opts.maxPerLine
 * @param {number} opts.minCount
 * @param {number} opts.maxCount
 * @returns {{ ok: true, subjects: NormalizedSubject[] } | { ok: false, errors: string[] }}
 */
function validateNormalizedSubjects(subjects, opts) {
  const errors = [];
  if (!Array.isArray(subjects)) {
    return { ok: false, errors: ['Subject list missing or not an array.'] };
  }
  const seen = new Set();
  const deduped = [];
  for (const s of subjects) {
    if (!s || typeof s.text !== 'string') continue;
    const text = s.text.trim();
    if (!text) continue;
    if (text.length > opts.maxPerLine) {
      errors.push(`Subject exceeds max length (${opts.maxPerLine}).`);
      continue;
    }
    if (PROFANITY.test(text)) {
      errors.push('Subject failed safety filter.');
      continue;
    }
    const tagCheck = validateMergeTagsInText(text);
    if (!tagCheck.ok) {
      errors.push(`Unsupported merge token: ${tagCheck.token}`);
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...s, text });
  }

  if (deduped.length < opts.minCount) {
    return {
      ok: false,
      errors:
        errors.length > 0
          ? errors
          : [`After validation ${deduped.length} valid subject(s); need ${opts.minCount}.`],
    };
  }
  return { ok: true, subjects: deduped.slice(0, opts.maxCount) };
}

module.exports = { validateNormalizedSubjects };
