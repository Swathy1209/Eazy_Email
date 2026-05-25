/** Row / job-level AI generation lifecycle (extensible for queues). */
const GENERATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
  TIMEOUT: 'TIMEOUT',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  PARTIAL_SUCCESS: 'PARTIAL_SUCCESS',
});

module.exports = { GENERATION_STATUS };
