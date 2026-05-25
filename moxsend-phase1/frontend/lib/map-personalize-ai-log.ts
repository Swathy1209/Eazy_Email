import type { AiGenerationLogDbRow } from '@/lib/ai-generation-log';
import type { PersonalizeAiLogRow } from '@/app/leads/components/PersonalizeAiLogTable';
import type { PersonalizeTelemetry } from '@/lib/personalize-telemetry';

const UI_STATUSES = new Set<PersonalizeAiLogRow['status']>([
  'SUCCESS',
  'FAILED',
  'INVALID_OUTPUT',
  'TIMEOUT',
  'VALIDATION_FAILED',
  'RETRYING',
]);

export function dbAiLogToUiRow(r: AiGenerationLogDbRow): PersonalizeAiLogRow {
  const input = r.input_payload as { variantLabel?: 'A' | 'B' } | null;
  const val = r.validated_payload as { variantLabel?: 'A' | 'B' } | null;
  const variant = val?.variantLabel ?? input?.variantLabel ?? 'A';
  const rawStatus = r.status as PersonalizeAiLogRow['status'];
  const status = UI_STATUSES.has(rawStatus) ? rawStatus : 'FAILED';
  return {
    id: `db-${r.id}`,
    at: new Date(r.created_at).getTime(),
    variant,
    traceId: r.trace_id ?? '',
    requestId: r.request_id,
    status,
    processingTimeMs: r.processing_time_ms ?? 0,
    tokenInput: r.token_input ?? undefined,
    tokenOutput: r.token_output ?? undefined,
    model: r.model ?? undefined,
    provider: r.provider ?? undefined,
    retryCount: r.retry_count ?? undefined,
    errorMessage: r.error_message ?? undefined,
    eventType: r.event_type,
  };
}

export function clientTelemetryEventType(t: PersonalizeTelemetry, isError: boolean): string {
  if (!isError) return 'GENERATION_COMPLETED';
  if (t.status === 'VALIDATION_FAILED') return 'VALIDATION_FAILED';
  if (t.status === 'INVALID_OUTPUT') return 'INVALID_OUTPUT';
  if (t.status === 'TIMEOUT') return 'TIMEOUT_OCCURRED';
  return 'GENERATION_FAILED';
}

export function personalizeLogsStorageKey(jobId: string | null): string {
  return `moxsend-personalize-ai-logs:${jobId ?? 'none'}`;
}

export function loadPersonalizeLogsFromSession(jobId: string | null): PersonalizeAiLogRow[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(personalizeLogsStorageKey(jobId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersonalizeAiLogRow[];
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.id === 'string' && !r.id.startsWith('db-')) : [];
  } catch {
    return [];
  }
}

export function savePersonalizeLogsToSession(jobId: string | null, logs: PersonalizeAiLogRow[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const clientOnly = logs.filter((l) => !l.id.startsWith('db-'));
    sessionStorage.setItem(personalizeLogsStorageKey(jobId), JSON.stringify(clientOnly));
  } catch {
    /* quota */
  }
}

export function clearPersonalizeLogsSession(jobId: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(personalizeLogsStorageKey(jobId));
  } catch {
    /* ignore */
  }
}

export function mergeDbAndSessionLogs(
  dbRows: PersonalizeAiLogRow[],
  sessionRows: PersonalizeAiLogRow[],
): PersonalizeAiLogRow[] {
  const byId = new Map<string, PersonalizeAiLogRow>();
  for (const r of dbRows) byId.set(r.id, r);
  for (const r of sessionRows) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => b.at - a.at).slice(0, 80);
}
