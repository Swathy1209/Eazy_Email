const app = require('../src/app');
const { initializeRuntime } = require('../src/runtime');

initializeRuntime({ enableRetentionSweep: false });

module.exports = app;

