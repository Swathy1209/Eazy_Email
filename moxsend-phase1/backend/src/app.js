const express = require('express');
const routes = require('./routes');
const { errorHandler } = require('./middleware/error.middleware');
const { corsMiddleware } = require('./middleware/cors.middleware');
const { requestLogger } = require('./middleware/requestLogger.middleware');
const { traceContextMiddleware } = require('./middleware/traceContext.middleware');

const app = express();

app.disable('x-powered-by');
app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use(traceContextMiddleware);
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(routes);

app.use(errorHandler);

module.exports = app;
