import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;
let cachedKey = '';

export function normalizeSupabaseUrl(raw: string): string {
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

export function getSupabaseConfig(): { url: string; key: string; configured: boolean } {
  const rawUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  return { url, key, configured: Boolean(url && key) };
}

export function supabaseConfigHint(): string {
  const { url, key } = getSupabaseConfig();
  const missing: string[] = [];
  if (!url) {
    missing.push('project URL (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL)');
  }
  if (!key) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!missing.length) return '';
  return `Missing: ${missing.join('; ')}. Add them to .env.local at the repo root and restart the dev server.`;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const { url, key, configured } = getSupabaseConfig();
  if (!configured) return null;
  const cacheKey = `${url}\0${key}`;
  if (!cached || cachedKey !== cacheKey) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedKey = cacheKey;
  }
  return cached;
}
