import type { RowResult } from './lead-types';

export const MERGE_TAG_KEYS = [
  'name',
  'company',
  'industry',
  'region',
  'city',
  'role',
  'website',
] as const;

export type MergeTagKey = (typeof MERGE_TAG_KEYS)[number];

export function rowToMergeValues(row: RowResult): Record<MergeTagKey, string> {
  return {
    name: row.name || `${row.firstname} ${row.lastname}`.trim() || 'there',
    company: row.company || '',
    industry: row.industry || '',
    region: row.country || '',
    city: row.city || '',
    role: row.designation || '',
    website: row.companyurl || '',
  };
}

export function applyMergeTags(template: string, row: RowResult): string {
  const v = rowToMergeValues(row);
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const k = key.toLowerCase() as MergeTagKey;
    if (k in v) return v[k as MergeTagKey];
    return `{{${key}}}`;
  });
}

export function countMergeTags(html: string): number {
  const m = html.match(/\{\{\s*\w+\s*\}\}/g);
  return m ? m.length : 0;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
