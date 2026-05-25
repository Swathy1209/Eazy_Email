export type RewriteField = 'subject' | 'body';

export type RewritePromptParams = {
  field: RewriteField;
  text: string;
  /** Pre-formatted context block lines (campaign, audience, offer), or empty string */
  contextBlock: string;
};

function rulesForField(field: RewriteField): string {
  if (field === 'subject') {
    return `Rewrite ONLY the subject: peer tone, not marketer; no Title Case; ≤7 words; one concrete ops detail (not "[industry] follow-ups"). Preserve merge tokens {{...}} exactly. One plain line — no body, HTML, markdown, or explanation.`;
  }
  return `Rewrite body HTML: elite outbound operator — observational, not promotional; strip SaaS buzzwords; shorter sentences; keep workflow-pain focus; soft CTAs. Preserve {{merge}} tokens and HTML tags. Output HTML fragment only, no markdown or preamble.`;
}

export function buildRewritePrompt(params: RewritePromptParams): string {
  const { field, text, contextBlock } = params;
  const rules = rulesForField(field);
  return `Expert B2B email editor.

${rules}

${contextBlock ? `Context:\n${contextBlock}\n\n` : ''}Current ${field}:
${text}`;
}
