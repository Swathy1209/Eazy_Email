import type { RowResult } from '@/lib/lead-types';

/** Stable id for personalize/refine/save APIs (DB row when present, else normalized email). */
export function stableLeadId(row: RowResult): string {
  const db = String(row.dbId ?? '').trim();
  if (db) return db;
  return String(row.email ?? '').trim().toLowerCase();
}
