# MOXSEND AI (`/ai`)

This folder contains MOXSEND’s AI runtime: LangGraph workflows, provider routing (Groq/Qwen), and an optional FastAPI server that exposes selected workflows over HTTP.

The product model is **base email → lead refinement**:
- Generate **one** cohort/campaign base email + subject set.
- Refine **one lead at a time** from that base email (no batch-per-lead regeneration during refinement).

---

## Quick Start

### 1) Configure `ai/.env`

**Groq (cloud)**

```env
LLM_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_TEMPERATURE=0.7
GROQ_MAX_TOKENS=1024
GROQ_REQUEST_TIMEOUT_S=30
GROQ_MAX_RETRIES=2
```

**Qwen 2.5 via Ollama (local)**

```env
LLM_PROVIDER=qwen
QWEN_MODEL=qwen2.5:7b
QWEN_TEMPERATURE=0.7
QWEN_MAX_TOKENS=1024
```

Provider switching is centralized in `ai/llm_handler/llm_handler.py`.

### 2) Run the optional FastAPI server

```powershell
cd ai
uv run python -m api.run
```

This starts on `http://localhost:8001` with docs at `http://localhost:8001/docs`.

### 3) Run the app

The main app typically runs:
- Express backend on `http://localhost:3001`
- Next.js frontend on `http://localhost:3000`

The backend can invoke LangGraph directly by running `ai/run_workflow.py` via `backend/src/utils/pythonBridge.js`.

---

## Provider Routing (Centralized LLM Access)

### Goal

No LangGraph node should know whether the active model is Groq (cloud) or Qwen (local). Nodes should only call:

- `llm.generate(prompt)` → plain text
- `llm.generate_json(prompt)` → JSON output

### Implementation

All provider routing is centralized in `ai/llm_handler/`:

- `ai/llm_handler/llm_handler.py`
  - Loads `ai/.env`
  - Selects provider based on:
    - `LLM_PROVIDER` env, else
    - `ACTIVE_PROVIDER` constant (default)
  - Exposes a shared `llm` object used across the repo.
- `ai/llm_handler/groq_handler.py`
  - Groq provider using `langchain_groq.ChatGroq`
  - Reads `GROQ_*` env vars.
- `ai/llm_handler/qwen_handler.py`
  - Qwen provider using `langchain_ollama.ChatOllama`
  - Reads `QWEN_*` env vars.

### Backward compatibility

Some legacy code expects `get_llm().invoke([...])`. That compatibility wrapper lives in:
- `ai/utils/llm_factory.py`

It routes into the centralized provider router so provider initialization is still single-sourced.

---

## LangGraph Workflows (`ai/moxsend_graph/`)

### 1) Campaign Base + Lead Refinement (`personalization_graph`)

Graph:
- `ai/moxsend_graph/graphs/personalization_graph.py`

State:
- `ai/moxsend_graph/states/personalization_state.py`

Nodes:
- `ai/moxsend_graph/nodes/generate_email.py` (base email, HTML output)
- `ai/moxsend_graph/nodes/generate_cohort_subjects.py` (cohort subject lines)
- `ai/moxsend_graph/nodes/refine_email.py` (single-lead refinement from base)

**Flow A — Base email creation**

Input (JSON):
```json
{
  "action": "generate_base",
  "selected_leads": [{ "...": "..." }],
  "campaign_brief": "string",
  "tone": "Professional",
  "market": "Global"
}
```

Output:
- `generated_base_email` (HTML)
- `generated_subject_lines` (list)

**Flow B — Lead refinement**

Input (JSON):
```json
{
  "action": "refine_lead",
  "base_email": "<p>...</p>",
  "base_subject": "string",
  "active_lead": { "...": "..." },
  "refinement_prompt": "Make it more technical",
  "tone": "Professional"
}
```

Output:
- `refined_email`: `{ "subject": "...", "bodyHtml": "<p>...</p>" }`

### 2) Subject lines pipeline (`subject_graph`)

This pipeline generates and scores subject lines for a lead:
- `ai/moxsend_graph/graphs/subject_graph.py`
- `ai/moxsend_graph/nodes/generate_subjects.py`
- `ai/moxsend_graph/nodes/score_subjects.py`

Phase 1 also adds a dedicated **subject optimizer** path in the same graph module:
- `generate_subject_variants_node`
- `score_subject_variants_node`
- `rank_subject_variants_node`

This optimizer accepts:
```json
{
  "subject_input": "What's the secret to a happier, healthier team?",
  "campaign_context": "optional",
  "tone": "optional"
}
```

It returns frontend-ready JSON:
```json
{
  "success": true,
  "variants": [
    {
      "id": 1,
      "subject": "string",
      "score": 95,
      "label": "Best",
      "angle": "AI angle: ..."
    }
  ]
}
```

Scoring is intentionally lightweight and production-safe:
- open-rate potential
- clarity
- brevity
- curiosity
- B2B professionalism
- deliverability-safe phrasing

The graph keeps the LLM centralized through `ai/llm_handler/llm_handler.py` and falls back to deterministic variants if the model request fails.

---

## Workflow Entrypoint (`ai/run_workflow.py`)

`ai/run_workflow.py` is the CLI-style entrypoint used by the Node backend.

It:
- Reads JSON from `stdin`
- Routes by `workflow`
- Invokes `personalization_graph` for the existing campaign/refinement flows
- Invokes the subject optimizer graph when `workflow == "subject_optimizer"`
- Writes JSON to `stdout` (so Node can parse it reliably)

Current bridge contract:
```json
// personalization
{ "action": "generate_base", ... }

// subject optimizer
{ "workflow": "subject_optimizer", "subject_input": "...", "campaign_context": "...", "tone": "..." }
```

---

## FastAPI Server (`ai/api/`)

The FastAPI server is a convenience layer that exposes certain workflows/utilities.

Primary file:
- `ai/api/main.py`

This includes endpoints for health checks, subject-lines generation, and other utilities (rewrite/translate/etc.) used by parts of the application.

---

## App Integration (Backend/Frontend)

### Backend (Express)

The Express backend invokes LangGraph via Python:
- `backend/src/utils/pythonBridge.js` runs `ai/run_workflow.py`
- `backend/src/controllers/ai.controller.js` exposes:
  - `POST /api/ai/cohort-email`
  - `POST /api/ai/refine-email`
  - `POST /api/ai/subject-optimizer`
- `backend/src/routes/ai.routes.js` registers the new subject optimizer route

Endpoints:
- `POST /api/ai/cohort-email` → base email + cohort subjects
- `POST /api/ai/refine-email` → refine one lead from the base email
- `POST /api/ai/subject-optimizer` → generate ranked subject variants from one subject idea

### Frontend (Next.js)

The subject optimizer UI now uses the same proxy pattern as the rest of the app:
- `frontend/app/leads/personalize/subject-optimizer/page.tsx`
- `frontend/components/personalize/SubjectOptimizer.tsx`
- `frontend/app/api/leads/personalize/subject-optimizer/route.ts`
- `frontend/lib/subject-optimizer.ts`

The button labeled `Generate Variants` now sends the user-entered subject idea to the backend, which runs the Python bridge and returns ranked variants, scores, labels, and angle explanations.

The existing personalization UI still uses:
- `frontend/app/api/leads/personalize/cohort/route.ts`
- `frontend/app/api/leads/personalize/refine/route.ts`
- `frontend/app/api/leads/personalize/save/route.ts`

---

## Persistence (Supabase) Notes

The existing persistence table is:
- `ai_personalize_generations`

Current key strategy (so we can persist base vs variants without changing the DB schema):
- Campaign base row: `reference_lead_email = campaign:<campaignId>`
- Lead variant row: `reference_lead_email = campaign:<campaignId>:lead:<leadId>`

This allows:
- One source-of-truth base email per campaign
- Many refined lead versions derived from that base

---

## Folder Map

```
ai/
├── api/                 # FastAPI server
├── llm_handler/         # Provider routing (Groq/Qwen) — single source of truth
├── moxsend_graph/       # LangGraph workflows (campaign + refinement + subject lines + subject optimizer)
├── prompts/             # TS prompts (legacy/auxiliary)
├── subject-lines/       # JS subject-lines module(s)
├── utils/               # legacy wrappers (compat)
├── run_workflow.py      # backend-invoked workflow entrypoint (routes personalization + subject optimizer)
├── pyproject.toml
└── README.md
```

## Diagram

![Alt text](dig.png)
