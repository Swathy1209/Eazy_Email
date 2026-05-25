const defaultPrompts = require('./pipelinePrompts');

/** @type {typeof defaultPrompts} */
let active = { ...defaultPrompts };

/**
 * Merge prompt builder overrides (e.g. alternate copy packs, tests, or future DB-backed prompts).
 * @param {Partial<typeof defaultPrompts>} overrides
 */
function registerPipelinePrompts(overrides) {
  active = { ...active, ...overrides };
}

function getPipelinePrompts() {
  return active;
}

/** Restore bundled defaults (tests / hot reload). */
function resetPipelinePrompts() {
  active = { ...defaultPrompts };
}

module.exports = {
  registerPipelinePrompts,
  getPipelinePrompts,
  resetPipelinePrompts,
};
