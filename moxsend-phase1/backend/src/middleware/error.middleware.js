const multer = require('multer');
const { ZodError } = require('zod');
const { AppError } = require('../utils/AppError');

/**
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {string} code
 */
function sendError(res, statusCode, message, code) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
    },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err && err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'Malformed JSON body.', 'INVALID_JSON');
  }

  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message, err.code || 'APP_ERROR');
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join('; ');
    return sendError(res, 400, message, 'VALIDATION_ERROR');
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, 'Uploaded file is too large.', 'FILE_TOO_LARGE');
    }
    return sendError(res, 400, 'File upload error.', err.code);
  }

  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);

  return sendError(res, 500, 'Unexpected server error.', 'INTERNAL_ERROR');
}

module.exports = { errorHandler };
