const { AppError } = require('../utils/AppError');

const requestBuckets = new Map();

function basicRateLimit({ windowMs, max }) {
  return (req, _res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const bucket = requestBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      requestBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= max) {
      return next(new AppError('Rate limit exceeded. Please retry shortly.', 429, 'RATE_LIMITED'));
    }
    bucket.count += 1;
    return next();
  };
}

module.exports = { basicRateLimit };
