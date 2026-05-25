/**
 * Pluggable AI capability registry for queue workers and future features.
 * Keep provider-specific code out of business routes; add new modules here.
 */
const { getSubjectLineRuntimeConfig } = require('../config/subjectLineRuntime');

const modules = Object.freeze({
  subjectLines: {
    id: 'subject-lines',
    description: 'Marketing / pipeline subject line generation',
    isEnabled: () => getSubjectLineRuntimeConfig().featureSubjectLines,
  },
  emailGeneration: {
    id: 'email-generation',
    description: 'Full email body, tone, personalization (planned)',
    isEnabled: () => String(process.env.AI_FEATURE_EMAIL_GENERATION ?? '0').trim() === '1',
  },
  sendTimeIntelligence: {
    id: 'send-time-intelligence',
    description: 'Send-time optimization (planned)',
    isEnabled: () => String(process.env.AI_FEATURE_SEND_TIME ?? '0').trim() === '1',
  },
  replyIntelligence: {
    id: 'reply-intelligence',
    description: 'Reply categorization and intent (planned)',
    isEnabled: () => String(process.env.AI_FEATURE_REPLY_INTEL ?? '0').trim() === '1',
  },
});

/**
 * @param {keyof typeof modules} key
 */
function assertModuleEnabled(key) {
  const m = modules[key];
  if (!m || !m.isEnabled()) {
    const err = new Error(`AI module disabled: ${key}`);
    err.code = 'AI_MODULE_DISABLED';
    throw err;
  }
}

module.exports = {
  modules,
  assertModuleEnabled,
};
