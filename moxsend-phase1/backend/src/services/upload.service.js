const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const { parseCsvFile } = require('./csvParse.service');
const { scheduleJobProcessing } = require('./processor');
const { saveJob } = require('../store/jobStore');
const { getJobRetentionMs } = require('../config/jobRetention');
const { AppError } = require('../utils/AppError');
const { safeUnlink } = require('../utils/fileCleanup');

/**
 * Persists a job shell then hands rows to the async processor.
 * @param {string} filePath
 * @returns {Promise<{ jobId: string, message: string }>}
 */
async function acceptCsvUpload(filePath) {
  const { rows } = await parseCsvFile(filePath);

  const jobId = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + getJobRetentionMs()).toISOString();

  /** @type {import('./jobTypes').JobRecord} */
  const job = {
    jobId,
    status: 'processing',
    createdAt,
    expiresAt,
    totalRows: rows.length,
    processedRows: 0,
    successCount: 0,
    failureCount: 0,
    data: [],
  };

  saveJob(jobId, job);
  scheduleJobProcessing(jobId, rows);

  return {
    jobId,
    message: 'File accepted. Processing started.',
  };
}

/**
 * Validates multer file metadata before touching the parser.
 * @param {import('multer').File | undefined} file
 */
async function assertValidUpload(file) {
  if (!file || !file.path) {
    throw new AppError('CSV file is required under field name "file".', 400, 'FILE_MISSING');
  }

  const mime = (file.mimetype || '').toLowerCase();
  const original = (file.originalname || '').toLowerCase();
  const looksCsv =
    mime === 'text/csv' ||
    mime === 'application/csv' ||
    mime === 'application/vnd.ms-excel' ||
    (mime === 'text/plain' && original.endsWith('.csv'));

  if (!looksCsv) {
    throw new AppError(
      'Invalid file type. Please upload a .csv file (text/csv).',
      415,
      'INVALID_FILE_TYPE',
    );
  }

  let stats;
  try {
    stats = await fs.stat(file.path);
  } catch {
    throw new AppError('Uploaded file could not be read.', 400, 'FILE_MISSING');
  }

  if (!stats.size) {
    throw new AppError('Uploaded file is empty.', 400, 'EMPTY_FILE');
  }
}

module.exports = {
  acceptCsvUpload,
  assertValidUpload,
};
