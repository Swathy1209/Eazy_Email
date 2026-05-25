import { loadEnvConfig } from '@next/env';
import path from 'path';
import type { NextConfig } from 'next';

/** Monorepo root: load `.env.local` from repo root (same cwd as `backend` + `frontend` siblings). */
const repoRoot = path.join(__dirname, '..');
loadEnvConfig(repoRoot);

/** Express URL in dev (root `npm run dev` uses PORT=3001). */
const internalApiOrigin = (process.env.INTERNAL_API_ORIGIN ?? 'http://localhost:3001').replace(
  /\/$/,
  '',
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: repoRoot,
  /** CSV and job routes proxy to Express; `/api/groq/*` is handled here. */
  async rewrites() {
    const d = `${internalApiOrigin}/api`;
    return [
      { source: '/api/upload', destination: `${d}/upload` },
      { source: '/api/stored-leads', destination: `${d}/stored-leads` },
      { source: '/api/retry/:jobId', destination: `${d}/retry/:jobId` },
      { source: '/api/status/:jobId', destination: `${d}/status/:jobId` },
      { source: '/api/result/:jobId/download', destination: `${d}/result/:jobId/download` },
      {
        source: '/api/result/:jobId/upload-to-database',
        destination: `${d}/result/:jobId/upload-to-database`,
      },
      { source: '/api/result/:jobId', destination: `${d}/result/:jobId` },
      { source: '/api/ai/:path*', destination: `${d}/ai/:path*` },
    ];

  },
};

export default nextConfig;
