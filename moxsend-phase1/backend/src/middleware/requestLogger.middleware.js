const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    logger.info('http', `${req.method} ${req.originalUrl}`, {
      statusCode: res.statusCode,
      durationMs: Date.now() - started,
      traceId: req.traceId,
      requestId: req.requestId,
    });
  });
  next();
}

module.exports = { requestLogger };
