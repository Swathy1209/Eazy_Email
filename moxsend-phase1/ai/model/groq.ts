import type { GenerateOptions, GroqTextGenerationMeta } from './types';

function stripCodeFence(raw: string): string {
  let s = raw.trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (m) s = m[1].trim();
  return s;
}

export function getGroqApiKey(): string | null {
  const k = process.env.GROQ_API_KEY?.trim();
  return k || null;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
}

type GroqChatCompletionsResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

function sanitizeAiText(text: string): string {
  if (!text) return '';
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

const DEFAULT_GROQ_TIMEOUT_MS = 120_000;

export async function groqGenerateText(prompt: string, options?: GenerateOptions): Promise<string> {
  const { text } = await groqGenerateTextWithMeta(prompt, options);
  return text;
}

export async function groqGenerateTextWithMeta(
  prompt: string,
  options?: GenerateOptions,
): Promise<GroqTextGenerationMeta> {
  const key = getGroqApiKey();
  if (!key) {
    throw new Error('GROQ_API_KEY is not set. Add it to `.env.local` at the repo root.');
  }
  const model = getGroqModel();
  const timeoutMs =
    options?.timeoutMs ?? (Number(process.env.GROQ_TIMEOUT_MS) || DEFAULT_GROQ_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: sanitizeAiText(prompt) }],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxOutputTokens ?? 2048,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      const err = new Error(`Groq request timed out after ${timeoutMs}ms`);
      (err as Error & { code?: string }).code = 'AI_TIMEOUT';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - started;
  const raw = await res.text();
  let data: GroqChatCompletionsResponse;
  try {
    data = JSON.parse(raw) as GroqChatCompletionsResponse;
  } catch {
    throw new Error(
      `Groq API returned non-JSON (${res.status}). Check GROQ_MODEL and API key. Body starts with: ${raw.slice(0, 120)}`,
    );
  }

  if (!res.ok) {
    throw new Error(data.error?.message || `Groq request failed (${res.status})`);
  }

  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) {
    throw new Error('Groq returned no text. Try again or check the model name.');
  }
  return { text, usage: data.usage, latencyMs, model };
}

function fixJsonString(raw: string): string {
  let inString = false;
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"' && raw[i - 1] !== '\\') {
      inString = !inString;
    }
    if (inString && (c === '\n' || c === '\r' || c === '\t')) {
      if (c === '\n') result += '\\n';
      else if (c === '\r') result += '\\r';
      else if (c === '\t') result += '\\t';
    } else {
      result += c;
    }
  }
  return result;
}

function parseJsonLoose<T>(raw: string): T {
  const cleaned = fixJsonString(stripCodeFence(raw.trim()));
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch (innerErr) {
        // Fallthrough to logging
      }
    }
    console.error('🔥 JSON Parse Failure!');
    console.error('Raw String Head:', cleaned.slice(0, 250));
    throw new Error(`Could not parse JSON from Groq response: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function groqGenerateJson<T>(prompt: string, options?: GenerateOptions): Promise<T> {
  const raw = await groqGenerateText(prompt, { temperature: 0.65, ...options });
  return parseJsonLoose<T>(raw);
}

export type GroqJsonGenerationMeta<T> = {
  data: T;
  rawText: string;
  usage?: GroqChatCompletionsResponse['usage'];
  latencyMs: number;
  model: string;
};

export async function groqGenerateJsonWithMeta<T>(
  prompt: string,
  options?: GenerateOptions,
): Promise<GroqJsonGenerationMeta<T>> {
  const meta = await groqGenerateTextWithMeta(prompt, { temperature: 0.65, ...options });
  const data = parseJsonLoose<T>(meta.text);
  return {
    data,
    rawText: meta.text,
    usage: meta.usage,
    latencyMs: meta.latencyMs,
    model: meta.model,
  };
}

