import type { PersonalizeTelemetry } from '@/lib/personalize-telemetry';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public telemetry?: PersonalizeTelemetry,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isProbablyHtml(body: string): boolean {
  const t = body.trimStart().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.startsWith('<');
}

export async function fetchJson<T>(input: string | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();

  if (isProbablyHtml(text)) {
    throw new ApiError(
      [
        `Got an HTML page instead of JSON (${res.status}).`,
        'Use the Next.js URL (usually http://localhost:3000), not the Express API port (3001).',
        'If you already use :3000, restart `npm run dev` from the repo root and try again.',
      ].join(' '),
      res.status,
    );
  }

  let data: unknown;
  try {
    data = text.length ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(`Invalid JSON (${res.status}): ${text.slice(0, 200).trim()}`, res.status);
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    const telemetry =
      typeof data === 'object' && data !== null && 'telemetry' in data
        ? ((data as { telemetry?: PersonalizeTelemetry }).telemetry ?? undefined)
        : undefined;
    throw new ApiError(msg, res.status, telemetry);
  }

  return data as T;
}

export function postJson<T>(url: string, body: object, opts?: { traceId?: string }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (opts?.traceId) headers['X-Trace-Id'] = opts.traceId;
  return fetchJson<T>(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
