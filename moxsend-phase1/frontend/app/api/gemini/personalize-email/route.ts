import { randomUUID } from 'crypto';
import { generateJsonWithMeta } from '@ai/model';
import type { EmailLength } from '@/lib/email-personalize-types';
import type { MergeTagKey } from '@/lib/merge-tags';
import { MERGE_TAG_KEYS } from '@/lib/merge-tags';
import type { RowResult } from '@/lib/lead-types';
import { getPrompts } from '@ai/model/prompts/promptRegistry';
import type { PersonalizeEmailPromptParams } from '@ai/prompts/personalize-email.prompt';
import { persistAiGenerationLog, safeJsonbPreview, type AiGenerationLogRow } from '@/lib/ai-generation-log';
import type { PersonalizeTelemetry } from '@/lib/personalize-telemetry';

export const runtime = 'nodejs';

const ALLOWED_LENGTHS: EmailLength[] = ['short', 'medium', 'long'];

type Body = PersonalizeEmailPromptParams & {
  jobId?: string;
  campaignId?: string;
  userId?: string;
  organizationId?: string;
};

const MAX_COHORT = 200;
const RAW_LOG_MAX = 24_000;

function isMergeTagKey(k: string): k is MergeTagKey {
  return (MERGE_TAG_KEYS as readonly string[]).includes(k);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function validateBody(raw: unknown): Body | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid JSON body' };
  const o = raw as Record<string, unknown>;
  const offer = String(o.offer ?? '').trim();
  if (!offer) return { error: 'offer is required' };
  const length = o.length as EmailLength;
  if (!ALLOWED_LENGTHS.includes(length)) return { error: 'length must be short, medium, or long' };
  const keys = o.personalizeKeys;
  if (!Array.isArray(keys) || !keys.length) return { error: 'personalizeKeys must be a non-empty array' };
  const personalizeKeys = keys.filter((x): x is MergeTagKey => typeof x === 'string' && isMergeTagKey(x));
  if (!personalizeKeys.length) return { error: 'No valid merge-tag keys' };
  const sampleRow = o.sampleRow;
  if (!sampleRow || typeof sampleRow !== 'object') return { error: 'sampleRow is required' };
  const sr = sampleRow as RowResult;
  if (!String(sr.email ?? '').trim()) return { error: 'sampleRow.email is required' };
  const vl = o.variantLabel;
  if (vl !== 'A' && vl !== 'B') return { error: 'variantLabel must be A or B' };
  const extraInstructions = String(o.extraInstructions ?? '');
  let cohortRows: RowResult[] | undefined;
  const cr = o.cohortRows;
  if (cr !== undefined) {
    if (!Array.isArray(cr)) return { error: 'cohortRows must be an array' };
    if (cr.length > MAX_COHORT) return { error: `cohortRows too large (max ${MAX_COHORT})` };
    cohortRows = [];
    for (const item of cr) {
      if (!item || typeof item !== 'object') return { error: 'Invalid cohortRows entry' };
      const row = item as RowResult;
      if (!String(row.email ?? '').trim()) return { error: 'Each cohort row must include email' };
      cohortRows.push(row);
    }
  }
  const jobId = o.jobId != null ? String(o.jobId).trim() || undefined : undefined;
  const campaignId = o.campaignId != null ? String(o.campaignId).trim() : undefined;
  const userId = o.userId != null ? String(o.userId).trim() : undefined;
  const organizationId = o.organizationId != null ? String(o.organizationId).trim() : undefined;
  if (campaignId && !isUuid(campaignId)) return { error: 'campaignId must be a UUID when provided' };
  if (userId && !isUuid(userId)) return { error: 'userId must be a UUID when provided' };
  if (organizationId && !isUuid(organizationId)) return { error: 'organizationId must be a UUID when provided' };

  return {
    offer,
    length,
    personalizeKeys,
    extraInstructions,
    sampleRow: sr,
    variantLabel: vl,
    cohortRows,
    jobId,
    campaignId,
    userId,
    organizationId,
  };
}

type GeminiOut = {
  subject: string;
  body: string;
  personalization_score: number;
  cultural_fit_score: number;
  reply_likelihood_score: number;
  language_mode: string;
  reasoning_summary: string;
};
const SUBJECT_MAX_WORDS = 10;

/** Caps completion tokens: structured email JSON is far smaller than Groq default (8192). */
function personalizeMaxOutputTokens(len: EmailLength): number {
  switch (len) {
    case 'short':
      return 1200;
    case 'medium':
      return 1800;
    case 'long':
      return 2600;
    default:
      return 1800;
  }
}

function trimToWordLimit(input: string, maxWords: number): string {
  const words = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ');
}

function hasMergeTag(input: string): boolean {
  return /\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/.test(input);
}

function ensurePersonalizedSubject(subject: string, personalizeKeys: MergeTagKey[]): string {
  const clean = subject.replace(/\s+/g, ' ').trim();
  if (!clean) return '{{name}} quick idea for your team';
  if (hasMergeTag(clean)) return clean;
  const preferred = personalizeKeys.includes('name')
    ? '{{name}}'
    : personalizeKeys.includes('company')
      ? '{{company}}'
      : personalizeKeys.length > 0
        ? `{{${personalizeKeys[0]}}}`
        : '{{name}}';
  return `${preferred}: ${clean}`;
}

function telemetryBase(
  requestId: string,
  traceId: string,
  processingTimeMs: number,
  partial: Partial<PersonalizeTelemetry> = {},
): PersonalizeTelemetry {
  return {
    traceId,
    requestId,
    status: 'FAILED',
    processingTimeMs,
    provider: 'groq',
    ...partial,
  };
}

function jsonResponse(
  body: object,
  status: number,
): Response {
  return Response.json(body, { status });
}

async function logPersist(row: AiGenerationLogRow, label: string) {
  const r = await persistAiGenerationLog(row);
  if (process.env.NODE_ENV === 'development' && !r.ok) {
    console.warn(`[personalize-email] ai_generation_logs (${label}):`, r.error);
  }
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  const headerTrace = req.headers.get('x-trace-id')?.trim();
  const traceId = headerTrace && isUuid(headerTrace) ? headerTrace : randomUUID();
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'production';
  const started = Date.now();

  let bodyPayload: Body | null = null;

  try {
    const rawJson = await req.json();
    const parsed = validateBody(rawJson);
    if ('error' in parsed) {
      const processingTimeMs = Date.now() - started;
      const tel = telemetryBase(requestId, traceId, processingTimeMs, { status: 'VALIDATION_FAILED' });
      await logPersist(
        {
          request_id: requestId,
          trace_id: traceId,
          event_type: 'VALIDATION_FAILED',
          status: 'VALIDATION_FAILED',
          validation_errors: [parsed.error],
          error_message: parsed.error,
          processing_time_ms: processingTimeMs,
          environment: env,
          input_payload: safeJsonbPreview(rawJson, 4000) as object,
        },
        'VALIDATION_FAILED',
      );
      return jsonResponse({ error: parsed.error, telemetry: tel }, 400);
    }
    bodyPayload = parsed;

    const inputSummary = {
      variantLabel: parsed.variantLabel,
      length: parsed.length,
      offerPreview: parsed.offer.slice(0, 280),
      offerLen: parsed.offer.length,
      personalizeKeys: parsed.personalizeKeys,
      extraInstructionsLen: (parsed.extraInstructions ?? '').length,
      cohortSize: parsed.cohortRows?.length ?? 1,
      sampleEmailDomain: String(parsed.sampleRow.email ?? '').split('@')[1] ?? '—',
    };

    await logPersist(
      {
        request_id: requestId,
        trace_id: traceId,
        job_id: parsed.jobId ?? null,
        campaign_id: parsed.campaignId ?? null,
        user_id: parsed.userId ?? null,
        organization_id: parsed.organizationId ?? null,
        provider: 'groq',
        event_type: 'REQUEST_RECEIVED',
        status: 'RETRYING',
        input_payload: inputSummary as object,
        environment: env,
      },
      'REQUEST_RECEIVED',
    );

    const prompt = getPrompts().buildPersonalizeEmailPrompt({
      offer: parsed.offer,
      length: parsed.length,
      personalizeKeys: parsed.personalizeKeys,
      extraInstructions: parsed.extraInstructions,
      sampleRow: parsed.sampleRow,
      variantLabel: parsed.variantLabel,
      cohortRows: parsed.cohortRows,
    });

    let retryCount = 0;
    let lastErr: Error | null = null;
    let meta: Awaited<ReturnType<typeof generateJsonWithMeta<GeminiOut>>> | null = null;
    let isTimeout = false;

    while (retryCount < 2) {
      try {
        // eslint-disable-next-line no-await-in-loop
        meta = await generateJsonWithMeta<GeminiOut>(prompt, {
          maxOutputTokens: personalizeMaxOutputTokens(parsed.length),
        });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        const code = (lastErr as Error & { code?: string }).code;
        isTimeout = code === 'AI_TIMEOUT';
        if (retryCount === 0) {
          retryCount += 1;
          await logPersist(
            {
              request_id: requestId,
              trace_id: traceId,
              job_id: parsed.jobId ?? null,
              campaign_id: parsed.campaignId ?? null,
              user_id: parsed.userId ?? null,
              organization_id: parsed.organizationId ?? null,
              provider: 'groq',
              event_type: 'RETRY_TRIGGERED',
              status: 'RETRYING',
              retry_count: retryCount,
              retry_reason: lastErr.message.slice(0, 500),
              error_message: lastErr.message.slice(0, 2000),
              is_timeout: isTimeout,
              environment: env,
            },
            'RETRY_TRIGGERED',
          );
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        throw lastErr;
      }
    }

    if (!meta) throw lastErr ?? new Error('Generation failed');

    const processingTimeMs = Date.now() - started;
    const tokenInput = meta.usage?.prompt_tokens;
    const tokenOutput = meta.usage?.completion_tokens;

    const out = meta.data;
    const rawSubject = String(out.subject ?? '').trim();
    const bodyHtml = String(out.body ?? '').trim();
    const subject = trimToWordLimit(ensurePersonalizedSubject(rawSubject, parsed.personalizeKeys), SUBJECT_MAX_WORDS);

    if (!subject || !bodyHtml) {
      const tel = telemetryBase(requestId, traceId, processingTimeMs, {
        status: 'INVALID_OUTPUT',
        providerLatencyMs: meta.latencyMs,
        tokenInput,
        tokenOutput,
        model: meta.model,
        retryCount,
      });
      await logPersist(
        {
          request_id: requestId,
          trace_id: traceId,
          job_id: parsed.jobId ?? null,
          campaign_id: parsed.campaignId ?? null,
          user_id: parsed.userId ?? null,
          organization_id: parsed.organizationId ?? null,
          provider: 'groq',
          model: meta.model,
          event_type: 'INVALID_OUTPUT',
          status: 'INVALID_OUTPUT',
          raw_response: safeJsonbPreview(meta.rawText, RAW_LOG_MAX) as object,
          validation_errors: ['Empty subject or body after parse'],
          processing_time_ms: processingTimeMs,
          token_input: tokenInput ?? null,
          token_output: tokenOutput ?? null,
          retry_count: retryCount,
          environment: env,
        },
        'INVALID_OUTPUT',
      );
      return jsonResponse(
        { error: 'Model returned empty subject or body', telemetry: tel },
        502,
      );
    }

    const tel: PersonalizeTelemetry = {
      traceId,
      requestId,
      status: 'SUCCESS',
      processingTimeMs,
      providerLatencyMs: meta.latencyMs,
      tokenInput,
      tokenOutput,
      model: meta.model,
      provider: 'groq',
      retryCount,
      variantLabel: parsed.variantLabel,
    };

    await logPersist(
      {
        request_id: requestId,
        trace_id: traceId,
        job_id: parsed.jobId ?? null,
        campaign_id: parsed.campaignId ?? null,
        user_id: parsed.userId ?? null,
        organization_id: parsed.organizationId ?? null,
        provider: 'groq',
        model: meta.model,
        event_type: 'GENERATION_COMPLETED',
        status: 'SUCCESS',
        validated_payload: inputSummary as object,
        raw_response: safeJsonbPreview(meta.rawText, RAW_LOG_MAX) as object,
        normalized_response: { subject, bodyHtml: safeJsonbPreview(bodyHtml, 120_000) } as object,
        processing_time_ms: processingTimeMs,
        token_input: tokenInput ?? null,
        token_output: tokenOutput ?? null,
        retry_count: retryCount,
        environment: env,
      },
      'GENERATION_COMPLETED',
    );

    return Response.json({
      ok: true,
      subject,
      body: bodyHtml,
      personalization_score: out.personalization_score || 0,
      cultural_fit_score: out.cultural_fit_score || 0,
      reply_likelihood_score: out.reply_likelihood_score || 0,
      language_mode: out.language_mode || 'en',
      reasoning_summary: out.reasoning_summary || '',
      telemetry: tel,
    });
  } catch (e) {
    const processingTimeMs = Date.now() - started;
    const message = e instanceof Error ? e.message : 'Generation failed';
    const code = e instanceof Error ? (e as Error & { code?: string }).code : undefined;
    const isTimeout = code === 'AI_TIMEOUT';
    const tel = telemetryBase(requestId, traceId, processingTimeMs, {
      status: isTimeout ? 'TIMEOUT' : 'FAILED',
    });

    await logPersist(
      {
        request_id: requestId,
        trace_id: traceId,
        job_id: bodyPayload?.jobId ?? null,
        campaign_id: bodyPayload?.campaignId ?? null,
        user_id: bodyPayload?.userId ?? null,
        organization_id: bodyPayload?.organizationId ?? null,
        provider: 'groq',
        event_type: isTimeout ? 'TIMEOUT_OCCURRED' : 'GENERATION_FAILED',
        status: isTimeout ? 'TIMEOUT' : 'FAILED',
        error_message: message.slice(0, 2000),
        error_stack:
          process.env.NODE_ENV === 'development' && e instanceof Error
            ? e.stack?.slice(0, 4000) ?? null
            : null,
        processing_time_ms: processingTimeMs,
        is_timeout: isTimeout,
        environment: env,
      },
      'GENERATION_FAILED',
    );

    return jsonResponse({ error: message, telemetry: tel }, 500);
  }
}
