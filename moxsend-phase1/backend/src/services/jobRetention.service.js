const { sweepExpiredJobs } = require('../store/jobStore');
const logger = require('../utils/logger');
const { getCleanupIntervalMs } = require('../config/jobRetention');

const SCOPE = 'retention';

/**
 * Starts periodic TTL sweeps. Returns a disposer for tests/shutdown.
 * @returns {() => void}
 */
function startJobRetentionSweep() {
  const tick = () => {
    try {
      const removed = sweepExpiredJobs();
      if (removed > 0) {
        logger.info(SCOPE, `Removed ${removed} expired job(s)`);
      }
    } catch (err) {
      logger.error(SCOPE, 'Scheduled cleanup failed', err);
    }
  };

  const ms = getCleanupIntervalMs();
  const handle = setInterval(tick, ms);
  if (typeof handle.unref === 'function') {
    handle.unref();
  }

  logger.info(SCOPE, 'Retention sweep started', { intervalMs: ms });

  return () => clearInterval(handle);
}

module.exports = {
  startJobRetentionSweep,
};
