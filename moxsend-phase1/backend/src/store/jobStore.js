/** @typedef {import('../services/jobTypes').JobRecord} JobRecord */

/** In-memory job registry (replace with Redis/DB in scaled deployments). */
const jobs = new Map();

/**
 * @param {string} jobId
 * @param {JobRecord} record
 */
function saveJob(jobId, record) {
  jobs.set(jobId, record);
}

/**
 * @param {string} jobId
 * @returns {JobRecord | undefined}
 */
function getJob(jobId) {
  return jobs.get(jobId);
}

/**
 * @param {string} jobId
 * @param {(job: JobRecord) => void} updater
 */
function updateJob(jobId, updater) {
  const job = jobs.get(jobId);
  if (!job) return;
  updater(job);
  jobs.set(jobId, job);
}

/**
 * @param {string} jobId
 * @returns {boolean}
 */
function deleteJob(jobId) {
  return jobs.delete(jobId);
}

/**
 * Deletes jobs whose `expiresAt` is in the past. Returns number removed.
 * @returns {number}
 */
function sweepExpiredJobs() {
  const now = Date.now();
  let removed = 0;
  for (const [id, job] of jobs) {
    if (job.expiresAt && new Date(job.expiresAt).getTime() <= now) {
      jobs.delete(id);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Resolves a job for API reads: missing, expired (and deleted), or ok.
 * @param {string} jobId
 * @returns {{ type: 'missing' } | { type: 'expired' } | { type: 'ok', job: import('../services/jobTypes').JobRecord }}
 */
function getJobForRequest(jobId) {
  const job = jobs.get(jobId);
  if (!job) return { type: 'missing' };
  if (job.expiresAt && new Date(job.expiresAt).getTime() <= Date.now()) {
    jobs.delete(jobId);
    return { type: 'expired' };
  }
  return { type: 'ok', job };
}

module.exports = {
  saveJob,
  getJob,
  getJobForRequest,
  updateJob,
  deleteJob,
  sweepExpiredJobs,
};
