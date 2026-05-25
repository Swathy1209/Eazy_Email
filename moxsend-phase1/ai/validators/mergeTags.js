/** Merge tags allowed in prompts and subject text (aligned with ai/shared/merge-tags + pipeline prompts). */
const ALLOWED_MERGE_TAGS = new Set([
  'name',
  'company',
  'industry',
  'region',
  'city',
  'role',
  'website',
  'designation',
]);

const MERGE_TAG_RE = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * @param {string} value
 * @returns {{ ok: true } | { ok: false, code: string, token: string }}
 */
function validateMergeTagsInText(value) {
  const s = String(value ?? '');
  let m;
  const re = new RegExp(MERGE_TAG_RE.source, MERGE_TAG_RE.flags);
  while ((m = re.exec(s)) !== null) {
    const key = String(m[1] ?? '').toLowerCase();
    if (!ALLOWED_MERGE_TAGS.has(key)) {
      return { ok: false, code: 'INVALID_MERGE_TAG', token: m[0] };
    }
  }
  return { ok: true };
}

module.exports = {
  ALLOWED_MERGE_TAGS,
  validateMergeTagsInText,
};
