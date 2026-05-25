/**
 * Wraps async route handlers so rejected promises reach the error middleware.
 * @param {import('express').RequestHandler} fn
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
