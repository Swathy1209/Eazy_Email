/**
 * Swappable prompt builders for Next route handlers.
 * Kept in a registry to allow overrides without touching HTTP logic.
 */

import { buildPersonalizeEmailPrompt } from '@ai/prompts/personalize-email.prompt';
import type { PersonalizeEmailPromptParams } from '@ai/prompts/personalize-email.prompt';
import { buildRewritePrompt } from '@ai/prompts/rewrite.prompt';
import type { RewritePromptParams } from '@ai/prompts/rewrite.prompt';
import { buildTranslateArPrompt } from '@ai/prompts/translate-ar.prompt';
import type { TranslateArPromptParams } from '@ai/prompts/translate-ar.prompt';

export type PromptBuilders = {
  buildPersonalizeEmailPrompt: (p: PersonalizeEmailPromptParams) => string;
  buildRewritePrompt: (p: RewritePromptParams) => string;
  buildTranslateArPrompt: (p: TranslateArPromptParams) => string;
};

const defaults: PromptBuilders = {
  buildPersonalizeEmailPrompt,
  buildRewritePrompt,
  buildTranslateArPrompt,
};

let active: PromptBuilders = { ...defaults };

export function registerPrompts(overrides: Partial<PromptBuilders>): void {
  active = { ...active, ...overrides };
}

export function resetPrompts(): void {
  active = { ...defaults };
}

export function getPrompts(): PromptBuilders {
  return active;
}

