# EasyHawk

CSV lead import pipeline: **upload → async job → per-row generation → poll results → export / retry failures**. Built as a small full-stack reference suitable for demos and interviews.

## What it does

1. **Upload** — `POST /api/upload` accepts a CSV with headers `Name`, `Company`, `Industry`, `City`. Validates file presence, MIME, non-empty file, required headers, and a **100-row** cap. Row-level issues are **not** rejected at upload; bad rows fail during processing.
2. **Background processing** — Each row gets a mock “LLM” bundle: opening line, email, two subject lines (industry-aware hooks). Progress is tracked (`processed`, `success`, `failed`, `percentage`).
3. **Results** — `GET /api/result/:jobId` (full payload), `GET /api/status/:jobId` (compact), `GET /api/result/:jobId/download` (CSV export), `POST /api/retry/:jobId` (reprocess **failed rows only**).
4. **Web UI** — Next.js dashboard (Tailwind) in **`../frontend`**: upload, live status, results table, output modal, download and retry.

## Repository layout

| Path | Role |
|------|------|
| `src/server.js` | HTTP server entry |
| `src/app.js` | Express app, CORS, JSON |
| `src/routes/` | Route mounting (`/api/...`) |
| `src/controllers/` | Thin HTTP handlers |
| `src/services/` | CSV parse, upload orchestration, processor, job responses, retention |
| `src/store/jobStore.js` | In-memory job `Map`, TTL sweep helpers |
| `src/middleware/` | CORS, errors |
| `uploads/` | Temporary multer disk target (cleaned after parse) |
| `../frontend/` | Next.js 15 App Router UI (sibling folder at repo root) |

## Prerequisites

- **Node.js** ≥ 18  
- **npm**

## Quick start (one command, one browser URL)

From **`backend/`** (this folder):

```bash
npm install
npm install --prefix ../frontend
npm run dev
```

Then open the URL Next prints (often **http://localhost:3050** if set in `frontend/.env.development`).

- **Browser** → only the Next dev server (proxies selected `/api/*` routes to Express on **3001**).  
- **API** → `http://127.0.0.1:3001` (used internally by rewrites).

### Scripts (`backend/package.json`)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Runs **API** (`PORT=3001`) and **frontend** (`wait-on` health → `next dev`) together |
| `npm start` | API only (`node src/server.js`, default `PORT=3000`) |
| `npm run dev:api` | API only |
| `npm run dev:web` | Frontend only (`npm run dev` in `../frontend`) |
| `npm run build:web` | Production build of `../frontend` |

### Environment variables

**API (Express)**

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3000` | In `npm run dev`, set to **3001** for the API child process |
| `CORS_ORIGIN` | Comma-separated localhost origins | Optional direct browser → API |
| `JOB_RETENTION_MINUTES` | `60` | Job expiry |
| `JOB_CLEANUP_INTERVAL_MINUTES` | `5` | Sweeper interval |

**Frontend (Next.js)** — see `../frontend`; common vars:

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | from `frontend/.env.development` | UI port |
| `INTERNAL_API_ORIGIN` | `http://127.0.0.1:3001` | Rewrite target for proxied `/api/*` |
| `NEXT_PUBLIC_API_URL` | _(empty)_ | Set only if UI calls API on another host |

Express also merges **`../frontend/.env.local`** (and repo-root `.env.local`) so shared keys stay in one place during local dev.

## API summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `POST` | `/api/upload` | Multipart field `file` (CSV) → `{ jobId, message }` |
| `GET` | `/api/result/:jobId` | Processing (`progress` + `percentage`) or terminal (`summary`, `data`) |
| `GET` | `/api/status/:jobId` | Same, without `data` when complete |
| `GET` | `/api/result/:jobId/download` | CSV attachment (terminal jobs) |
| `POST` | `/api/retry/:jobId` | Retry failed rows only → `202` |

Errors are JSON: `{ "error": "...", "code": "..." }`.

## Production notes (short)

- Replace in-memory store with **Postgres** (or similar) + **job queue** (SQS, BullMQ, etc.) for multi-instance workers.
- Move file handling to **object storage**; tighten limits and virus scanning.
- Swap mock generation for a **real LLM** client with timeouts, retries, and cost controls.
- Add **authentication**, per-tenant quotas, and **webhooks** instead of (or beside) polling.

## License

Private / unlicensed unless you add one.
