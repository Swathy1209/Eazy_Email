const { isUuid } = require('../utils/uuid');
const { getJobForRequest } = require('../store/jobStore');
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');

const SCOPE = 'jobs';

/**
 * @param {string | undefined} raw
 * @returns {string}
 */
function parseJobIdParam(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new AppError('Invalid job id.', 400, 'INVALID_JOB_ID');
  }
  const id = raw.trim();
  if (!isUuid(id)) {
    throw new AppError('Invalid job id.', 400, 'INVALID_JOB_ID');
  }
  return id;
}

/**
 * @param {string} jobId
 * @returns {import('./jobTypes').JobRecord}
 */
function loadJobForApi(jobId) {
  const resolved = getJobForRequest(jobId);

  if (resolved.type === 'missing') {
    logger.warn(SCOPE, 'Job not found', { jobId });
    const hint =
      process.env.NODE_ENV === 'production'
        ? ''
        : ' The API stores jobs in memory; if it restarted (e.g. file save with node --watch), upload the CSV again.';
    throw new AppError(`Job not found.${hint}`, 404, 'JOB_NOT_FOUND');
  }

  if (resolved.type === 'expired') {
    logger.info(SCOPE, 'Job expired on read', { jobId });
    throw new AppError('Job has expired.', 404, 'JOB_EXPIRED');
  }

  return resolved.job;
}

module.exports = {
  parseJobIdParam,
  loadJobForApi,
};
