export type TranslateArPromptParams = {
  subject: string;
  bodyHtml: string;
  /** Pre-formatted context block or empty */
  contextBlock: string;
};

export function buildTranslateArPrompt(params: TranslateArPromptParams): string {
  const { subject, bodyHtml, contextBlock } = params;
  return `Professional EN→MSA Arabic translator for B2B email. Natural business Arabic, not literal. Formal but readable.

Keep merge tokens EXACT: {{name}}, {{company}}, etc. — never translate inside {{}}. Keep HTML tags/attributes; translate visible text only.

Output ONLY JSON (no markdown): {"subject":"...","bodyHtml":"<p>...</p>"}

${contextBlock ? `Context:\n${contextBlock}\n\n` : ''}Subject:
${subject}

Body HTML:
${bodyHtml}`;
}

