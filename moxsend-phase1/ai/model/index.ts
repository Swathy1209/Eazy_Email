import type { AiProvider, GenerateOptions } from './types';
import { geminiGenerateJson, geminiGenerateText, getGeminiApiKey } from './gemini';
import { getGroqApiKey, groqGenerateJson, groqGenerateJsonWithMeta, groqGenerateText } from './groq';

export type { AiProvider, GenerateOptions };

export function getPrimaryProvider(): AiProvider {
  return 'groq';
}

export function getBackupProvider(): AiProvider {
  return 'gemini';
}

function providerConfigured(p: AiProvider): boolean {
  if (p === 'gemini') return Boolean(getGeminiApiKey());
  return Boolean(getGroqApiKey());
}

export function getConfiguredProviders(): AiProvider[] {
  const ordered: AiProvider[] = [getPrimaryProvider(), getBackupProvider()];
  return ordered.filter(providerConfigured);
}

export async function generateText(prompt: string, options?: GenerateOptions): Promise<string> {
  // --- Groq/Gemini path (default / fallback) ---
  const providers = getConfiguredProviders();

  if (providers.length === 0) {
    throw new Error('No AI providers configured. Check GEMINI_API_KEY or GROQ_API_KEY in .env.local');
  }

  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        return await geminiGenerateText(prompt, options);
      } else {
        return await groqGenerateText(prompt, options);
      }
    } catch (e) {
      console.error(`${provider} Text Generation Failed:`, e);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error('Text generation failed on all providers');
}

export async function generateJson<T>(prompt: string, options?: GenerateOptions): Promise<T> {
  // --- Groq/Gemini path (default / fallback) ---
  const providers = getConfiguredProviders();

  if (providers.length === 0) {
    throw new Error('No AI providers configured. Check GEMINI_API_KEY or GROQ_API_KEY in .env.local');
  }

  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        return await geminiGenerateJson<T>(prompt);
      } else {
        return await groqGenerateJson<T>(prompt, options);
      }
    } catch (e) {
      console.error(`${provider} JSON Generation Failed:`, e);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error('JSON generation failed on all providers');
}
export { groqGenerateJsonWithMeta };
export type { GroqJsonGenerationMeta } from './groq';

/** JSON generation with token usage and latency (for observability).
 *
 * This function handles generating structured JSON via the primary AI provider (Groq)
 * with a fallback mechanism if the primary provider fails.
 */
export async function generateJsonWithMeta<T>(prompt: string, options?: GenerateOptions) {
  // --- Groq path (default / fallback) ---
  const primary = getPrimaryProvider();
  if (!providerConfigured(primary)) {
    throw new Error('GROQ_API_KEY is not configured in .env.local');
  }
  try {
    return await groqGenerateJsonWithMeta<T>(prompt, options);
  } catch (e) {
    console.error('Groq JSON Generation Failed:', e);
    throw e;
  }
}
