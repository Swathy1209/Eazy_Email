const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { startJobRetentionSweep } = require('./services/jobRetention.service');

let initialized = false;
let retentionStarted = false;

function loadLocalEnvFiles() {
  const backendRoot = path.join(__dirname, '..');
  const repoRoot = path.join(backendRoot, '..');

  // Load from Repo Root (highest priority for global config)
  const rootEnvPath = path.join(repoRoot, '.env.local');
  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  }

  // Frontend env files are loaded here so backend and frontend share local vars.
  const frontendRoot = path.join(repoRoot, 'frontend');
  dotenv.config({ path: path.join(frontendRoot, '.env') });
  dotenv.config({ path: path.join(frontendRoot, '.env.local') });

  const envLocalPath = path.join(backendRoot, '.env.local');
  if (!fs.existsSync(envLocalPath) && !fs.existsSync(rootEnvPath)) return;

  const activeEnvPath = fs.existsSync(rootEnvPath) ? rootEnvPath : envLocalPath;
  const parsed = dotenv.parse(fs.readFileSync(activeEnvPath));
  const forceFromFile = new Set([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]);

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined || value === '') continue;
    if (key === 'PORT') {
      if (!process.env.PORT) process.env.PORT = value;
      continue;
    }
    if (forceFromFile.has(key)) {
      process.env[key] = value;
      continue;
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function initializeRuntime({ enableRetentionSweep = true } = {}) {
  if (!initialized) {
    loadLocalEnvFiles();
    initialized = true;
  }

  if (enableRetentionSweep && !retentionStarted) {
    startJobRetentionSweep();
    retentionStarted = true;
  }
}

module.exports = {
  initializeRuntime,
};

