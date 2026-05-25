const { getPipelinePrompts } = require('../../../ai/pipeline/pipelinePromptRegistry');
const { buildLeadGenerationContext } = require('../utils/leadRowContext');
const { generateOptimizedSubjectLines } = require('./subjectLine.service');

/** @typedef {import('../../../ai/pipeline/pipelinePrompts').PipelineModelPrompt} PipelineModelPrompt */

/**
 * @param {import('../utils/leadRowContext').LeadGenerationContext} ctx
 * @param {PipelineModelPrompt} prompt
 * @returns {Promise<string>}
 */
async function executeEmailGeneration(ctx, prompt) {
  void prompt;
  
  // Realism mock using new operational framework and domain-specific workflow selection for HR/onboarding
  const body = [
    `Hi {{name}},`,
    '',
    `As remote teams grow, onboarding usually becomes harder to coordinate once setup tasks, approvals, and requests start spreading across different tools and teams.`,
    '',
    `Over time, small steps get missed, new hires wait longer for access or responses, and managers spend more time chasing updates than actually helping people ramp up smoothly.`,
    '',
    `Some teams are reducing this by automating onboarding handoffs and routing setup tasks earlier in the workflow. That usually keeps onboarding moving without adding extra coordination work.`,
    '',
    `Could be relevant depending on how {{company}} currently handles onboarding workflows.`
  ].join('\n');
  
  return {
    subject: "Requests start bouncing between teams",
    body: body,
    personalization_score: 92,
    cultural_fit_score: 85,
    reply_likelihood_score: 88,
    language_mode: "en",
    reasoning_summary: "Diagnosed onboarding coordination pain successfully.",
    variants: []
  };
}

/**
 * @param {import('../utils/leadRowContext').LeadGenerationContext} ctx
 * @param {string} emailBody
 * @param {PipelineModelPrompt} prompt
 * @returns {Promise<[string, string]>}
 */
async function executeSubjectGeneration(ctx, emailBody, prompt) {
  void emailBody;
  void prompt;
  const subject1 = `Why onboarding starts slowing down`;
  const subject2 = `Setup tasks and missing approvals`;
  return [subject1, subject2];
}

/**
 * @param {import('./jobTypes').JobRow} row
 * @returns {Promise<string>}
 */
async function generateEmail(row) {
  const ctx = buildLeadGenerationContext(row);
  const { buildEmailGenerationPrompt } = getPipelinePrompts();
  const prompt = buildEmailGenerationPrompt(ctx);
  return executeEmailGeneration(ctx, prompt);
}

/**
 * @param {import('./jobTypes').JobRow} row
 * @param {string} emailBody
 * @returns {Promise<Array<{style: string, subject: string, score: number, reason: string}>>}
 */
async function generateSubjectLines(row, emailBody) {
  const ctx = buildLeadGenerationContext(row);
  return generateOptimizedSubjectLines(ctx, emailBody);
}

/**
 * @param {import('./jobTypes').JobRow} rowData
 * @returns {Promise<{ openingLine: string, email: string, subjectLines: {style: string, subject: string, score: number, reason: string}[] }>}
 */
async function generateFullEmailBundle(rowData) {
  const email = await generateEmail(rowData);
  const subjectLines = await generateSubjectLines(rowData, email);
  const openingLine = String(email)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) || '';
  return { openingLine, email, subjectLines };
}

module.exports = {
  generateEmail,
  generateSubjectLines,
  generateFullEmailBundle,
  executeEmailGeneration,
  executeSubjectGeneration,
};
