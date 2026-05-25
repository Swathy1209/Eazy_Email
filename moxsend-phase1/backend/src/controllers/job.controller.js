const { asyncHandler } = require('../utils/asyncHandler');
const { parseJobIdParam, loadJobForApi } = require('../services/jobQuery.service');
const {
  buildResultResponse,
  buildStatusResponse,
} = require('../services/jobResponse.service');
const { scheduleRetryFailedRows } = require('../services/processor');
const { buildResultsCsv } = require('../utils/csvExport');
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');
const { upsertLeadsFromJob } = require('../services/supabase.service');

const SCOPE = 'http';

/**
 * GET /api/result/:jobId — full payload including `data` when finished.
 */
const getJobResult = asyncHandler(async (req, res) => {
  const jobId = parseJobIdParam(req.params.jobId);
  const job = loadJobForApi(jobId);

  logger.info(SCOPE, 'GET /api/result', { jobId, jobStatus: job.status });

  res.json(buildResultResponse(job));
});

/**
 * GET /api/status/:jobId — compact polling (no row `data` on completion).
 */
const getJobStatus = asyncHandler(async (req, res) => {
  const jobId = parseJobIdParam(req.params.jobId);
  const job = loadJobForApi(jobId);

  logger.info(SCOPE, 'GET /api/status', { jobId, jobStatus: job.status });

  res.json(buildStatusResponse(job));
});

/**
 * GET /api/result/:jobId/download — CSV export of row-level outcomes.
 */
const getJobResultDownload = asyncHandler(async (req, res) => {
  const jobId = parseJobIdParam(req.params.jobId);
  const job = loadJobForApi(jobId);

  if (job.status === 'processing') {
    throw new AppError(
      'Job not finished yet. Download is available after completion.',
      409,
      'JOB_PROCESSING',
    );
  }

  logger.info(SCOPE, 'GET /api/result/download', { jobId, jobStatus: job.status });

  const csv = buildResultsCsv(job.data);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="job-${jobId.slice(0, 8)}.csv"`);
  res.send(csv);
});

/**
 * POST /api/retry/:jobId — reprocess **only** failed rows in the background.
 */
const postJobRetry = asyncHandler(async (req, res) => {
  const jobId = parseJobIdParam(req.params.jobId);
  const job = loadJobForApi(jobId);

  if (job.status === 'processing') {
    throw new AppError('Job is still processing.', 409, 'JOB_BUSY');
  }

  if (job.status !== 'completed' && job.status !== 'failed') {
    throw new AppError('Job cannot be retried in its current state.', 400, 'INVALID_JOB_STATE');
  }

  const failedRows = job.data.filter((r) => r.status === 'failed').length;
  if (!failedRows) {
    throw new AppError('No failed rows to retry.', 400, 'NO_FAILED_ROWS');
  }

  logger.info(SCOPE, 'POST /api/retry', { jobId, failedRows });

  scheduleRetryFailedRows(jobId);

  res.status(202).json({
    jobId,
    message: 'Retry started for failed rows only.',
    failedRows,
  });
});

/**
 * POST /api/result/:jobId/upload-to-database — persist selected rows (Supabase stub).
 * Body: { indices: number[] } — indices into `job.data`.
 */
const postUploadToDatabase = asyncHandler(async (req, res) => {
  const jobId = parseJobIdParam(req.params.jobId);
  const job = loadJobForApi(jobId);

  if (job.status === 'processing') {
    throw new AppError('Job is still processing.', 409, 'JOB_BUSY');
  }

  const raw = req.body?.indices;
  if (!Array.isArray(raw)) {
    throw new AppError('Request body must include `indices` array.', 400, 'INVALID_BODY');
  }

  const indices = raw
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < job.data.length);

  if (!indices.length) {
    throw new AppError('No valid row indices to upload.', 400, 'NO_ROWS');
  }

  const rows = indices.map((i) => job.data[i]);

  logger.info(SCOPE, 'POST /api/result/upload-to-database', {
    jobId,
    rowCount: rows.length,
  });

  try {
    const { count } = await upsertLeadsFromJob(jobId, indices, rows);
    res.status(200).json({
      jobId,
      inserted: count,
      message: `Saved ${count} row(s) to Supabase (table: leads).`,
    });
  } catch (err) {
    if (err && err.code === 'SUPABASE_NOT_CONFIGURED') {
      throw new AppError(err.message, 503, 'SUPABASE_NOT_CONFIGURED');
    }
    logger.error(SCOPE, 'Supabase upsert failed', err);
    throw new AppError(
      err instanceof Error ? err.message : 'Failed to save rows to Supabase.',
      502,
      'SUPABASE_ERROR',
    );
  }
});

module.exports = {
  getJobResult,
  getJobStatus,
  getJobResultDownload,
  postJobRetry,
  postUploadToDatabase,
};
