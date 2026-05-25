/**
 * @typedef {Object} LeadGenerationContext
 * @property {string} email
 * @property {string} firstname
 * @property {string} lastname
 * @property {string} phone
 * @property {string} company
 * @property {string} companyurl
 * @property {string} city
 * @property {string} country
 * @property {string} designation
 * @property {string} industry
 * @property {string} company_size
 * @property {string} lead_type
 * @property {string} source
 * @property {string} tags
 * @property {string} notes
 * @property {string} displayName
 * @property {string} industryHook
 */

/** Per-industry hook phrases for generation context (keys matched case-insensitively). */
const industryHooks = {
  logistics: 'optimizing last-mile delivery',
  retail: 'improving in-store and digital conversion',
  technology: 'building scalable, reliable systems',
  healthcare: 'enhancing patient experience and outcomes',
  finance: 'strengthening risk-aware growth',
  manufacturing: 'tightening throughput and quality',
  education: 'improving learner engagement at scale',
  energy: 'balancing reliability with the transition to cleaner power',
  media: 'growing audience engagement across channels',
  hospitality: 'elevating guest experience and repeat visits',
  consulting: 'turning strategy into measurable client outcomes',
  insurance: 'modernizing claims and customer trust',
  agriculture: 'improving yield and supply-chain resilience',
  automotive: 'accelerating product and software-defined roadmaps',
  telecommunications: 'hardening networks and customer-facing reliability',
  government: 'delivering citizen-centric digital services',
  nonprofit: 'deepening donor and community impact',
};

/**
 * @param {string} rawIndustry
 * @returns {string}
 */
function resolveIndustryHook(rawIndustry) {
  const trimmed = String(rawIndustry || '').trim();
  if (!trimmed) {
    return 'scaling what matters in your market';
  }
  const key = trimmed.toLowerCase();
  if (industryHooks[key]) {
    return industryHooks[key];
  }
  const firstToken = key.split(/[\s&,/+]+/).filter(Boolean)[0];
  if (firstToken && industryHooks[firstToken]) {
    return industryHooks[firstToken];
  }
  return `leading with focus in the ${trimmed} space`;
}

/**
 * @param {import('../services/jobTypes').JobRow} row
 * @returns {string}
 */
function displayNameFromRow(row) {
  const first = String(row.firstname ?? '').trim();
  const last = String(row.lastname ?? '').trim();
  return [first, last].filter(Boolean).join(' ').trim();
}

/**
 * Normalized fields shared by the CSV pipeline and prompt builders.
 * @param {import('../services/jobTypes').JobRow} row
 */
function buildLeadGenerationContext(row) {
  const company = String(row.company ?? '').trim();
  const industry = String(row.industry ?? '').trim();
  const city = String(row.city ?? '').trim();
  const country = String(row.country ?? '').trim();
  return {
    email: String(row.email ?? '').trim(),
    firstname: String(row.firstname ?? '').trim(),
    lastname: String(row.lastname ?? '').trim(),
    phone: String(row.phone ?? '').trim(),
    company,
    companyurl: String(row.companyurl ?? '').trim(),
    city,
    country,
    designation: String(row.designation ?? '').trim(),
    industry,
    company_size: String(row.company_size ?? '').trim(),
    lead_type: String(row.lead_type ?? '').trim(),
    source: String(row.source ?? '').trim(),
    tags: String(row.tags ?? '').trim(),
    notes: String(row.notes ?? '').trim(),
    displayName: displayNameFromRow(row) || 'there',
    industryHook: resolveIndustryHook(industry),
  };
}

module.exports = {
  industryHooks,
  resolveIndustryHook,
  displayNameFromRow,
  buildLeadGenerationContext,
};
