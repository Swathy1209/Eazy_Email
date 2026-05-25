export type AiProvider = 'groq' | 'gemini';

export type GenerateOptions = {
  temperature?: number;
  /** Defaults to 8192 when omitted. Use a small value for short outputs (e.g. subject lines). */
  maxOutputTokens?: number;
  /** Abort long-running Groq calls (ms). */
  timeoutMs?: number;
};

/** OpenAI-compatible usage from Groq chat completions. */
export type GroqUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type GroqTextGenerationMeta = {
  text: string;
  usage?: GroqUsage;
  /** Time waiting on Groq HTTP response (ms). */
  latencyMs: number;
  model: string;
};

