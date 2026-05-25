const { createClient } = require('@supabase/supabase-js');

/**
 * @typedef {import('./jobTypes').ProcessedRowResult} ProcessedRowResult
 */

let cached;
/** @type {string | undefined} */
let cachedKey;

/**
 * Supabase client expects the project URL origin only (e.g. https://xxxx.supabase.co).
 * If SUPABASE_URL includes /rest/v1 or a trailing path, PostgREST returns PGRST125.
 * @param {string} raw
 */
function normalizeSupabaseUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  let u = s;
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.host}`.replace(/\/$/, '');
  } catch {
    return s.replace(/\/$/, '');
  }
}

function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  return { url, key, configured: Boolean(url && key) };
}

/**
 * Human-readable hint when admin client cannot be created (no secrets in log).
 */
function supabaseConfigHint() {
  const { url, key } = getSupabaseConfig();
  const missing = [];
  if (!url) {
    missing.push('project URL (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL)');
  }
  if (!key) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY (service_role JWT from Supabase → Project Settings → API)');
  }
  if (!missing.length) return '';
  return `Missing: ${missing.join('; ')}. Add them to .env.local at the repo root (same folder as package.json) and restart the API process (npm run dev).`;
}

/**
 * Singleton Supabase client (service role — server only).
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
function getSupabaseAdmin() {
  const { url, key, configured } = getSupabaseConfig();
  if (!configured) {
    return null;
  }
  const cacheKey = `${url}\0${key}`;
  if (!cached || cachedKey !== cacheKey) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedKey = cacheKey;
  }
  return cached;
}

/**
 * @param {string} jobId
 * @param {number[]} indices
 * @param {ProcessedRowResult[]} rows parallel to indices
 */
function mapRowsForInsert(jobId, indices, rows) {
  return indices.map((rowIndex, i) => {
    const r = rows[i];
    const o = r.output;
    return {
      import_job_id: jobId,
      row_index: rowIndex,
      email: r.email,
      firstname: r.firstname,
      lastname: r.lastname,
      display_name: r.name,
      phone: r.phone,
      company: r.company,
      companyurl: r.companyurl || null,
      city: r.city,
      country: r.country,
      designation: r.designation || null,
      industry: r.industry,
      company_size: r.company_size || null,
      lead_type: r.lead_type || null,
      source: r.source || null,
      tags: r.tags || null,
      notes: r.notes || null,
      processing_status: r.status,
      error: r.error ?? null,
      opening_line: o?.openingLine ?? null,
      generated_email: o?.email ?? null,
      subject_1: o?.subjectLines?.[0]?.subject ?? null,
      subject_2: o?.subjectLines?.[1]?.subject ?? null,
    };
  });
}

/**
 * Upsert leads by (import_job_id, row_index).
 * @param {string} jobId
 * @param {number[]} indices
 * @param {ProcessedRowResult[]} rows
 */
async function upsertLeadsFromJob(jobId, indices, rows) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const hint = supabaseConfigHint();
    const err = new Error(
      hint ||
        'Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY and a project URL in .env.local at the repo root.',
    );
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }

  const payload = mapRowsForInsert(jobId, indices, rows);
  const { data, error } = await supabase
    .from('leads')
    .upsert(payload, { onConflict: 'import_job_id,row_index' })
    .select('id');

  if (error) {
    const err = new Error(error.message || 'Supabase insert failed');
    err.code = error.code;
    err.details = error;
    throw err;
  }

  return { count: data?.length ?? payload.length, ids: (data ?? []).map((r) => r.id) };
}

/**
 * Map a Supabase `leads` row to the same shape the web UI uses for CSV results.
 * @param {Record<string, unknown>} r
 * @returns {ProcessedRowResult & { dbId?: string, importJobId?: string | null }}
 */
function mapDbLeadToRowResult(r) {
  const firstname = String(r.firstname ?? '');
  const lastname = String(r.lastname ?? '');
  const display = String(r.display_name ?? '').trim();
  const name = display || [firstname, lastname].filter(Boolean).join(' ').trim();
  const status = r.processing_status === 'failed' ? 'failed' : 'success';
  const subjectLines = [String(r.subject_1 ?? ''), String(r.subject_2 ?? '')]
    .filter(Boolean)
    .map((subject, idx) => ({
      style: idx === 0 ? 'Primary' : 'Secondary',
      subject,
      score: 6,
      reason: 'Loaded from database export columns.',
    }));
  const gen = r.generated_email;
  const opening = r.opening_line;
  const output =
    status === 'success' && (gen || opening)
      ? {
          openingLine: String(opening ?? ''),
          email: String(gen ?? ''),
          subjectLines,
        }
      : null;

  /** @type {ProcessedRowResult & { dbId?: string, importJobId?: string | null }} */
  const row = {
    email: String(r.email ?? ''),
    firstname,
    lastname,
    name,
    phone: String(r.phone ?? ''),
    company: String(r.company ?? ''),
    companyurl: String(r.companyurl ?? ''),
    city: String(r.city ?? ''),
    country: String(r.country ?? ''),
    designation: String(r.designation ?? ''),
    industry: String(r.industry ?? ''),
    company_size: String(r.company_size ?? ''),
    lead_type: String(r.lead_type ?? ''),
    source: String(r.source ?? ''),
    tags: String(r.tags ?? ''),
    notes: String(r.notes ?? ''),
    status,
    output,
    ...(r.error ? { error: String(r.error) } : {}),
  };
  if (r.id != null) row.dbId = String(r.id);
  if (r.import_job_id != null) row.importJobId = String(r.import_job_id);
  return row;
}

/**
 * Latest saved leads for the import dashboard (Supabase optional).
 * @param {number} [limit]
 * @returns {Promise<{ configured: boolean, leads: ReturnType<typeof mapDbLeadToRowResult>[], hint?: string }>}
 */
async function listStoredLeadsForUi(limit = 100) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      configured: false,
      leads: [],
      hint: supabaseConfigHint() || undefined,
    };
  }

  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const { data, error } = await supabase.from('leads').select('*').limit(lim);

  if (error) {
    const err = new Error(error.message || 'Supabase query failed');
    err.code = error.code;
    err.details = error;
    throw err;
  }

  const rows = data ?? [];
  rows.sort((a, b) => {
    const t1 = a.created_at ? new Date(a.created_at).getTime() : 0;
    const t2 = b.created_at ? new Date(b.created_at).getTime() : 0;
    const n1 = Number.isFinite(t1) ? t1 : 0;
    const n2 = Number.isFinite(t2) ? t2 : 0;
    if (n1 !== n2) return n2 - n1;
    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
  });

  return {
    configured: true,
    leads: rows.map(mapDbLeadToRowResult),
  };
}

module.exports = {
  normalizeSupabaseUrl,
  getSupabaseConfig,
  supabaseConfigHint,
  getSupabaseAdmin,
  upsertLeadsFromJob,
  mapRowsForInsert,
  mapDbLeadToRowResult,
  listStoredLeadsForUi,
};
