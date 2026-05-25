import type { LeadsSessionPayload } from './lead-types';
import { LEADS_SESSION_KEY } from './lead-types';

export function saveLeadsSession(payload: Omit<LeadsSessionPayload, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  const full: LeadsSessionPayload = { ...payload, savedAt: Date.now() };
  try {
    sessionStorage.setItem(LEADS_SESSION_KEY, JSON.stringify(full));
  } catch {
    // quota or private mode
  }
}

export function loadLeadsSession(): LeadsSessionPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LEADS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeadsSessionPayload;
    if (!parsed || !Array.isArray(parsed.leads)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLeadsSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LEADS_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
