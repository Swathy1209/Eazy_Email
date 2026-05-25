/**
 * How long completed/failed jobs stay in memory (minutes). Env override for ops tuning.
 * @returns {number}
 */
function getJobRetentionMinutes() {
  const raw = Number(process.env.JOB_RETENTION_MINUTES);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 60;
}

/**
 * @returns {number} milliseconds
 */
function getJobRetentionMs() {
  return getJobRetentionMinutes() * 60 * 1000;
}

/**
 * Background sweep interval (minutes).
 * @returns {number} milliseconds
 */
function getCleanupIntervalMs() {
  const raw = Number(process.env.JOB_CLEANUP_INTERVAL_MINUTES);
  if (Number.isFinite(raw) && raw > 0) return raw * 60 * 1000;
  return 5 * 60 * 1000;
}

module.exports = {
  getJobRetentionMinutes,
  getJobRetentionMs,
  getCleanupIntervalMs,
};
