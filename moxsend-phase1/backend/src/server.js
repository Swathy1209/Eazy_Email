const app = require('./app');
const { initializeRuntime } = require('./runtime');

initializeRuntime({ enableRetentionSweep: true });

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`CSV API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
