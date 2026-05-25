# AI processing (backend + `ai` package)

This document describes the subject-line pipeline, validation, retries, logging, and how to extend the architecture for future AI features. All AI-specific logic lives under the repo root `ai/` directory; the Express app in `backend/` validates HTTP requests, attaches trace context, and calls into `ai/`.

## Layout

| Path | Role |
|------|------|
| `ai/config/` | Timeouts, retry limits, feature flags (`AI_FEATURE_*`) |
| `ai/constants/` | Event type names, generation status enums |
| `ai/logging/` | Structured JSON logs (redacted in production) |
| `ai/parsers/` | Safe JSON extraction from model text |
| `ai/providers/` | HTTP provider + deterministic pipeline stub |
| `ai/retries/` | Exponential backoff helper |
| `ai/validators/` | Merge-tag rules, output safety / shape checks |
| `ai/services/` | Orchestration (`runSubjectLineGeneration`) |
| `ai/subject-lines/` | Brief-based prompts + caching + shared normalization |
| `ai/modules/` | Feature registry for future modules |
| `backend/src/validation/` | Zod schemas for API bodies |
| `backend/src/middleware/traceContext.middleware.js` | `traceId` / `requestId` per request |
| `backend/sql/ai_generation_logs.sql` | Optional Supabase audit table |

## API flow (`POST /api/ai/subject-lines`)

1. **Trace context** — `traceContextMiddleware` sets `req.traceId` (from `X-Trace-Id` if valid UUID, else new) and `req.requestId`.
2. **Request validation** — `subjectLinesRequestSchema` (Zod): `brief` (required), optional `industry`, `targetRole`, `country`, `tone`, UUIDs for `campaignId` / `userId` / `organizationId`, optional `cohort` / `rows` / `personalizationVariables` with size limits. Empty `cohort` or `rows` arrays are rejected.
3. **Merge tags** — Allowed placeholders in string fields: `name`, `company`, `industry`, `region`, `city`, `role`, `website`, `designation`.
4. **Persistence (best-effort)** — `ai_generation_logs` row with `REQUEST_RECEIVED` and non-sensitive `input_payload` summary.
5. **Orchestration** — `runSubjectLineGeneration` in `brief` mode: HTTP provider if `SUBJECT_AI_ENDPOINT` is set; otherwise deterministic local fallbacks. Never returns raw provider errors to the client.
6. **Response** — Deterministic JSON:

```json
{
  "success": true,
  "traceId": "...",
  "requestId": "...",
  "subjects": [{ "text": "...", "score": 0.91 }],
  "subjectLines": [{ "style": "...", "subject": "...", "score": 9, "reason": "..." }]
}
```

`subjects[].score` is normalized to **0–1**. `subjectLines[].score` remains **1–10** for backward compatibility with CSV and UI code.

## Processing lifecycle (conceptual)

States for row/batch jobs (aligned with `ai/constants/generationStatus.js`):

- `PENDING` → `PROCESSING` → `SUCCESS` | `FAILED` | `TIMEOUT` | `INVALID_OUTPUT` | `PARTIAL_SUCCESS`
- Retries: `RETRYING` (see structured logs / `retry_count` on audit rows)

CSV import processing (`processor.js`) already retries only failed rows and preserves successful outputs; row-level AI orchestration uses the same `runSubjectLineGeneration` in `pipeline` mode.

## Retry architecture

| Trigger | Behavior |
|---------|----------|
| Network / 5xx / 429 | `withRetry` on the HTTP provider with exponential backoff (`AI_RETRY_BASE_MS`, `AI_RETRY_MAX_MS`, `AI_SUBJECT_NETWORK_RETRIES`) |
| Invalid JSON, invalid shape, safety validation | Generation attempt retry (`AI_SUBJECT_MAX_ATTEMPTS`) with backoff |
| Timeout | AbortController on fetch; treated as retryable network failure |
| Exhausted retries | `FALLBACK_USED` — template subject lines pad to five (`brief` mode) or stub/fallback (`pipeline` mode) |

Partial batch behavior: preserve successful rows; retry only failures (existing job store semantics).

## Valid AI output shapes

The parser accepts either:

```json
{
  "subjects": [{ "text": "Quick question regarding {{company}}", "score": 0.91 }]
}
```

or legacy:

```json
{
  "subjectLines": [
    { "style": "Curiosity", "subject": "...", "score": 8.5, "reason": "..." }
  ]
}
```

Outputs are deduplicated, length-limited, merge-tag checked, and run through a minimal safety filter before use.

## Error handling (client-facing)

| Situation | HTTP | `error.code` |
|-----------|------|--------------|
| Zod / merge-tag validation | 400 | `VALIDATION_ERROR` / `INVALID_MERGE_TAG` |
| Malformed JSON body | 400 | `INVALID_JSON` |
| Unexpected server failure | 500 | `INTERNAL_ERROR` |

Provider messages, API keys, and stack traces are **not** exposed in JSON responses.

## Logging

- **Console**: one JSON line per event (`ai` scope) with `eventType` from `AI_EVENT_TYPES` (`REQUEST_RECEIVED`, `VALIDATION_FAILED`, `GENERATION_STARTED`, `GENERATION_COMPLETED`, `RETRY_TRIGGERED`, `INVALID_OUTPUT`, `FALLBACK_USED`, etc.).
- **Production**: no full email bodies, secrets, or end-user PII in payloads; brief text is not written to `ai_generation_logs` from the API layer (only lengths / flags).
- **Debug raw model text**: set `AI_DEBUG_LOG_RAW=1` in non-production to include a truncated preview in logs (never in client responses).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SUBJECT_AI_ENDPOINT` | POST URL; body `{ "prompt": "..." }` |
| `SUBJECT_AI_API_KEY` | Optional `Authorization: Bearer` |
| `AI_SUBJECT_TIMEOUT_MS` | Per-request timeout (default 8000) |
| `AI_SUBJECT_MAX_ATTEMPTS` | Generation attempts after parse/validate failure |
| `AI_SUBJECT_NETWORK_RETRIES` | HTTP-layer retries for 5xx/429/network |
| `AI_RETRY_BASE_MS` / `AI_RETRY_MAX_MS` | Backoff bounds |
| `AI_SUBJECT_MAX_LENGTH` | Max characters per subject line |
| `AI_FEATURE_SUBJECT_LINES` | Set `0` to disable module |
| `AI_LOG_ENVIRONMENT` | Stored on audit rows |
| `AI_DEBUG_LOG_RAW` | Include truncated raw responses in logs (non-prod) |

## Future modules

Register flags in `ai/modules/aiModuleRegistry.js` and add new orchestrators under `ai/services/` that reuse `providers/`, `parsers/`, `validators/`, and `retries/` without changing Express routes drastically.
