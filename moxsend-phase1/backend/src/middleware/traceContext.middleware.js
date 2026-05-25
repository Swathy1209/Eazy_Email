const { randomUUID } = require('crypto');
const { isUuid } = require('../utils/uuid');

/**
 * Adds traceId (for distributed tracing) and requestId (per HTTP request).
 */
function traceContextMiddleware(req, _res, next) {
  const headerTrace = req.headers['x-trace-id'] || req.headers['x-request-trace'];
  const traceId =
    typeof headerTrace === 'string' && isUuid(headerTrace.trim())
      ? headerTrace.trim()
      : randomUUID();
  req.traceId = traceId;
  req.requestId = randomUUID();
  next();
}

module.exports = { traceContextMiddleware };
