const { randomUUID } = require('crypto');
const { buildSubjectLineSystemPrompt, buildSubjectLineUserPrompt, buildRewriteSubjectUserPrompt } = require('../../../ai/pipeline/subjectLinePrompts');
const { runSubjectLineGeneration } = require('../../../ai/services/subjectLineGeneration.service');

/**
 * Deterministically generates a score based on context constraints (rewrite mock only).
 * @param {number} baseScore
 * @returns {number}
 */
function calculateScore(baseScore) {
  const jitter = Math.random() * 0.5 - 0.25;
  return Math.min(10.0, Math.max(1.0, Number((baseScore + jitter).toFixed(1))));
}

/**
 * Core service: shared AI orchestration (HTTP provider or deterministic stub).
 *
 * @param {import('../utils/leadRowContext').LeadGenerationContext} ctx
 * @param {string} emailBody
 * @param {object} [options]
 * @param {string} [options.traceId]
 * @param {string} [options.requestId]
 * @param {string} [options.jobId]
 * @returns {Promise<Array<{style: string, subject: string, score: number, reason: string}>>}
 */
async function generateOptimizedSubjectLines(ctx, emailBody, options) {
  const systemPrompt = buildSubjectLineSystemPrompt();
  const userPrompt = buildSubjectLineUserPrompt(ctx, emailBody);
  const prompt = `${systemPrompt}\n\n${userPrompt}`;
  const traceId = options?.traceId || randomUUID();
  const requestId = options?.requestId || randomUUID();
  const result = await runSubjectLineGeneration(
    { mode: 'pipeline', prompt, ctx, emailBody },
    { traceId, requestId, jobId: options?.jobId },
    options?.hooks,
  );
  return result.variants || result.subjectLines || [];
}

/**
 * Simulates rewriting an existing subject line based on user instructions.
 * 
 * @param {string} originalSubject 
 * @param {string} feedback 
 * @returns {Promise<Array<{style: string, subject: string, score: number, reason: string}>>}
 */
async function rewriteSubjectLine(originalSubject, feedback) {
  // In production, passes buildRewriteSubjectUserPrompt(originalSubject, feedback) to LLM.
  return [
    {
      label: "Rewrite 1",
      subject: `{{name}}, quick idea for {{company}}'s delayed responses`,
      open_rate_score: calculateScore(85),
      reasoning: "Adjusted to be more casual while targeting the workflow friction."
    },
    {
      label: "Rewrite 2",
      subject: `Leads slipping through the cracks at {{company}}`,
      open_rate_score: calculateScore(88),
      reasoning: "Made punchier and focused on the pain point as requested."
    },
    {
      label: "Rewrite 3",
      subject: `Automating {{company}}'s follow-up cycles`,
      open_rate_score: calculateScore(82),
      reasoning: "More professional tone highlighting the practical outcome."
    }
  ];
}

module.exports = {
  generateOptimizedSubjectLines,
  rewriteSubjectLine
};
