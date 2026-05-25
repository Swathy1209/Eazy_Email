import type { RowResult } from '@/lib/lead-types';
import type { MergeTagKey } from '@/lib/merge-tags';
import { stableLeadId } from '@/lib/lead-id';

export const PERSONALIZE_WORKSPACE_KEY = 'moxsend-personalize-workspace-v1';

/** Per-lead persisted workspace (sessionStorage). */
export type PersonalizeLeadSlotSnapshot = {
  subject: string;
  bodyHtml: string;
  refinedSubject?: string;
  refinedBodyHtml?: string;
  arSubject?: string;
  arBodyHtml?: string;
  personalizationReasoning?: string;
  humanizationAnalysis?: string;
  personalizationScore?: number;
  culturalScore?: number;
  replyLikelihood?: number;
  lastSavedAt?: string;
};

/** @deprecated v1 only — retained for migration */
export type PersonalizeGeneratedPayload = {
  subject: string;
  bodyHtml: string;
};

export type PersonalizeWorkspaceSnapshotV2 = {
  version: 2;
  jobId: string | null;
  cohortSignature: string;
  offer: string;
  emailLength: 'short' | 'medium' | 'long';
  personalizeKeys: MergeTagKey[];
  extraInstructions: string;
  activeLeadId: string | null;
  slotsByLeadId: Record<string, PersonalizeLeadSlotSnapshot>;
  hasAnimatedFirstGeneration: boolean;
  savedAt: number;
};

/** Legacy snapshot shape */
export type PersonalizeWorkspaceSnapshotV1 = {
  version: 1;
  jobId: string | null;
  cohortSignature: string;
  offer: string;
  emailLength: 'short' | 'medium' | 'long';
  personalizeKeys: MergeTagKey[];
  extraInstructions: string;
  referenceLeadIndex: number;
  generatedByLead: PersonalizeGeneratedPayload[];
  translatedByLead: PersonalizeGeneratedPayload[];
  hasAnimatedFirstGeneration: boolean;
  savedAt: number;
};

export type PersonalizeWorkspaceSnapshot = PersonalizeWorkspaceSnapshotV2 | PersonalizeWorkspaceSnapshotV1;

export function cohortSignature(leads: RowResult[]): string {
  return leads
    .map((l) => String(l.email ?? '').trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
}

function migrateV1ToV2(parsed: PersonalizeWorkspaceSnapshotV1, leads: RowResult[]): PersonalizeWorkspaceSnapshotV2 {
  const slotsByLeadId: Record<string, PersonalizeLeadSlotSnapshot> = {};
  leads.forEach((lead, i) => {
    const id = stableLeadId(lead);
    const g = parsed.generatedByLead[i] ?? { subject: '', bodyHtml: '' };
    const t = parsed.translatedByLead[i];
    slotsByLeadId[id] = {
      subject: typeof g.subject === 'string' ? g.subject : '',
      bodyHtml: typeof g.bodyHtml === 'string' ? g.bodyHtml : '',
      ...(t?.subject || t?.bodyHtml
        ? { arSubject: t.subject, arBodyHtml: t.bodyHtml }
        : {}),
    };
  });
  const refIdx = Math.min(Math.max(0, parsed.referenceLeadIndex ?? 0), Math.max(leads.length - 1, 0));
  const activeLeadId = leads[refIdx] ? stableLeadId(leads[refIdx]) : leads[0] ? stableLeadId(leads[0]) : null;
  return {
    version: 2,
    jobId: parsed.jobId,
    cohortSignature: parsed.cohortSignature,
    offer: parsed.offer,
    emailLength: parsed.emailLength,
    personalizeKeys: parsed.personalizeKeys,
    extraInstructions: parsed.extraInstructions,
    activeLeadId,
    slotsByLeadId,
    hasAnimatedFirstGeneration: parsed.hasAnimatedFirstGeneration,
    savedAt: parsed.savedAt,
  };
}

export function loadPersonalizeWorkspaceSnapshot(
  jobId: string | null,
  cohortSignatureValue: string,
  leads: RowResult[],
): PersonalizeWorkspaceSnapshotV2 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PERSONALIZE_WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersonalizeWorkspaceSnapshot>;
    if (parsed?.jobId !== jobId) return null;
    if (parsed?.cohortSignature !== cohortSignatureValue) return null;

    if (parsed.version === 2 && parsed.slotsByLeadId && typeof parsed.slotsByLeadId === 'object') {
      return parsed as PersonalizeWorkspaceSnapshotV2;
    }

    if (
      parsed.version === 1 &&
      Array.isArray(parsed.generatedByLead) &&
      Array.isArray(parsed.translatedByLead) &&
      leads.length > 0
    ) {
      return migrateV1ToV2(parsed as PersonalizeWorkspaceSnapshotV1, leads);
    }

    return null;
  } catch {
    return null;
  }
}

export function savePersonalizeWorkspaceSnapshot(
  snapshot: Omit<PersonalizeWorkspaceSnapshotV2, 'version' | 'savedAt'>,
): void {
  if (typeof window === 'undefined') return;
  const full: PersonalizeWorkspaceSnapshotV2 = {
    ...snapshot,
    version: 2,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(PERSONALIZE_WORKSPACE_KEY, JSON.stringify(full));
  } catch {
    /* quota / private mode */
  }
}
