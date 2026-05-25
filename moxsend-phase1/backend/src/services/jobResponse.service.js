/** @typedef {import('./jobTypes').JobRecord} JobRecord */

/**
 * @param {JobRecord} job
 */
function progressPercentage(job) {
  if (!job.totalRows) return 0;
  return Math.min(100, Math.round((job.processedRows / job.totalRows) * 100));
}

function buildProgress(job) {
  return {
    total: job.totalRows,
    processed: job.processedRows,
    success: job.successCount,
    failed: job.failureCount,
    percentage: progressPercentage(job),
  };
}

/**
 * @param {JobRecord} job
 */
function buildSummary(job) {
  return {
    total: job.totalRows,
    success: job.successCount,
    failed: job.failureCount,
  };
}

/**
 * Full result payload — includes row-level outcomes while processing and when finished.
 * @param {JobRecord} job
 */
function buildResultResponse(job) {
  if (job.status === 'processing') {
    return {
      status: 'processing',
      progress: buildProgress(job),
      data: job.data,
    };
  }

  if (job.status === 'completed') {
    return {
      status: 'completed',
      summary: buildSummary(job),
      data: job.data,
    };
  }

  // Terminal failure (e.g. worker crash) — still return partial row results when present.
  return {
    status: 'failed',
    summary: buildSummary(job),
    data: job.data,
  };
}

/**
 * Lightweight status (no `data` array) for polling.
 * @param {JobRecord} job
 */
function buildStatusResponse(job) {
  if (job.status === 'processing') {
    return {
      status: 'processing',
      progress: buildProgress(job),
    };
  }

  return {
    status: job.status,
    summary: buildSummary(job),
  };
}

module.exports = {
  buildResultResponse,
  buildStatusResponse,
  buildProgress,
  progressPercentage,
};
