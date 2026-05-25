/**
 * Browser access from the Next.js dev app (or other configured origins).
 * Set `CORS_ORIGIN` to a comma-separated list.
 * Default includes the Next.js dev UI (port 3000) for direct API calls; with rewrites the browser
 * usually only hits Next, so CORS is secondary in dev.
 */
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3050',
  'http://127.0.0.1:3050',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

function parseAllowedOrigins() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || !raw.trim()) return DEFAULT_ORIGINS;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

module.exports = { corsMiddleware };
