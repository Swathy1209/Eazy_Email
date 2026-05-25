import type { GenerateOptions } from './types';

function stripCodeFence(raw: string): string {
  let s = raw.trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (m) s = m[1].trim();
  return s;
}

export function getGeminiApiKey(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
}

type GeminiGenerateOptions = GenerateOptions & {
  responseMimeType?: 'application/json' | 'text/plain';
};

function sanitizeAiText(text: string): string {
  if (!text) return '';
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

export async function geminiGenerateText(prompt: string, options?: GeminiGenerateOptions): Promise<string> {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set. Add it to `.env.local` at the repo root.');
  }
  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const generationConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.7,
    maxOutputTokens: options?.maxOutputTokens ?? 8192,
  };
  if (options?.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: sanitizeAiText(prompt) }] }],
      generationConfig,
    }),
  });

  const raw = await res.text();
  let data: {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error(
      `Gemini API returned non-JSON (${res.status}). Check GEMINI_MODEL and API key. Body starts with: ${raw.slice(0, 120)}`,
    );
  }

  if (!res.ok) {
    throw new Error(data.error?.message || `Gemini request failed (${res.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text.trim()) {
    throw new Error('Gemini returned no text. Try again or check the model name.');
  }
  return text;
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
    throw new Error(`Could not parse JSON from Gemini response: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function geminiGenerateJson<T>(prompt: string): Promise<T> {
  let raw: string;
  try {
    raw = await geminiGenerateText(prompt, { responseMimeType: 'application/json', temperature: 0.65 });
  } catch {
    raw = await geminiGenerateText(prompt, { temperature: 0.65 });
  }
  return parseJsonLoose<T>(raw);
}

