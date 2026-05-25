/**
 * Deterministic stub when no HTTP provider is configured (pipeline / job processing).
 * Mirrors previous mockLlmSubjectLineCall output shape for JSON parsing.
 *
 * @param {Record<string, unknown>} ctx
 * @param {string} emailBody
 * @returns {string}
 */
function buildPipelineStubResponseJson(ctx, emailBody) {
  void emailBody;
  void ctx;
  const payload = {
    subjectLines: [
      {
        style: 'Curiosity',
        subject: `Why warm leads quietly disappear`,
        score: 9.1,
        reason: 'Highlights a hidden operational pain without sounding promotional.',
      },
      {
        style: 'Urgency',
        subject: `Pipeline momentum slowing down at {{company}}`,
        score: 8.8,
        reason: 'Addresses a concrete business consequence tied directly to revenue.',
      },
      {
        style: 'Personalized',
        subject: `{{name}}, a specific question about {{company}}'s response cycles`,
        score: 9.4,
        reason: 'Uses merge tags naturally in a peer-to-peer framing to ask an operational question.',
      },
      {
        style: 'Question-based',
        subject: `How is {{company}} handling scattered follow-ups?`,
        score: 8.6,
        reason: 'Hyper-specific to sales workflow friction, driving immediate relevance.',
      },
      {
        style: 'Short',
        subject: `{{company}} / pipeline momentum`,
        score: 8.5,
        reason: 'Ultra-concise, optimized for mobile viewing, leaning purely on business operations.',
      },
    ],
  };
  return JSON.stringify(payload);
}

module.exports = { buildPipelineStubResponseJson };
