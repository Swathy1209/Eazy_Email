/**
 * Operational errors the API can translate into HTTP responses.
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string} [code]
   */
  constructor(message, statusCode = 400, code) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = { AppError };
