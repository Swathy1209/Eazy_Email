"""
Moxsend AI Subject Line API — FastAPI Application

Endpoints:
  GET  /health           — liveness check
  POST /prompt           — raw prompt pass-through (Node.js SUBJECT_AI_ENDPOINT target)
  POST /generate         — batch subject line generation for 1–N leads
  POST /subject-lines    — single/multi brief mode (drop-in for Node.js endpoint)

Run with:
  cd ai
  uv run python -m api.run
"""

from __future__ import annotations

import logging
import sys
import time
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Import the LangGraph pipeline
# ---------------------------------------------------------------------------
# We do a lazy import inside each endpoint to give a clean startup error
# rather than failing at import time if Ollama is not yet running.
def _get_pipeline():
    from moxsend_graph.graphs.subject_graph import run_subject_pipeline
    return run_subject_pipeline


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
from api.schemas import (
    BatchGenerateRequest,
    BatchGenerateResponse,
    LeadInput,
    LeadResult,
    LeadMeta,
    PromptRequest,
    PromptRawResponse,
    SubjectLineCanonical,
    SubjectLineRequest,
    SubjectLineResponse,
    SubjectLineVariant,
    SubjectLineEntry,
    PersonalizeEmailRequest,
    PersonalizeEmailResponse,
    PersonalizeTelemetry,
    AiGenerationLogItem,
    AiPersonalizeSaveItem,
    AiPersonalizeSaveRequest,
)

MODEL_NAME = "qwen2.5:7b"

# ---------------------------------------------------------------------------
# In-memory stores (session-scoped — cleared on server restart)
# These replace Supabase for generation logs and personalize saves.
# ---------------------------------------------------------------------------
import uuid as _uuid
from datetime import datetime, timezone
from collections import deque

_AI_GENERATION_LOGS: deque = deque(maxlen=200)  # newest-last, cap at 200
_AI_PERSONALIZE_SAVES: list = []  # append-only during session


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log_event(
    event_type: str,
    status: str,
    request_id: str,
    trace_id: str,
    job_id: str | None = None,
    processing_time_ms: int = 0,
    error_message: str | None = None,
    retry_count: int = 0,
    provider: str = "qwen",
    model: str = MODEL_NAME,
) -> None:
    """Append an event to the in-memory generation log."""
    _AI_GENERATION_LOGS.append({
        "id": str(_uuid.uuid4()),
        "created_at": _now_iso(),
        "request_id": request_id,
        "trace_id": trace_id,
        "job_id": job_id,
        "event_type": event_type,
        "status": status,
        "provider": provider,
        "model": model,
        "processing_time_ms": processing_time_ms,
        "error_message": error_message,
        "retry_count": retry_count,
    })


# ---------------------------------------------------------------------------
# Lifespan (warm-up graph on startup)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Moxsend AI API — warming up LangGraph graph...")
    try:
        # Import + compile the graph (singleton) at startup to avoid cold-start
        # latency on the first real request.
        from moxsend_graph.graphs.subject_graph import _get_graph
        _get_graph()
        logger.info("LangGraph subject graph compiled and ready.")
    except Exception as exc:
        logger.warning("Graph warm-up failed (Ollama may not be ready yet): %s", exc)
    yield
    logger.info("Moxsend AI API shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Moxsend AI — Subject Line API",
    description=(
        "LangGraph-powered subject line generation using Qwen (local Ollama). "
        "Processes 1–N leads per request."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Error handler
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": str(exc)},
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health", tags=["System"])
async def health():
    """Liveness check — confirms the server and Ollama connection are up."""
    try:
        # from langchain_ollama import ChatOllama
        # llm = ChatOllama(model=MODEL_NAME, temperature=0)
        from utils.llm_factory import get_llm
        llm = get_llm(temperature=0)
        # Minimal probe: ask for a single word
        resp = llm.invoke([("human", "Reply with only the word OK.")])
        ollama_ok = "ok" in resp.content.lower()
    except Exception as exc:
        logger.warning("Health check — Ollama probe failed: %s", exc)
        ollama_ok = False

    return {
        "status": "ok" if ollama_ok else "degraded",
        "model": MODEL_NAME,
        "ollama_reachable": ollama_ok,
    }


# ---------------------------------------------------------------------------
# POST /generate — batch endpoint
# ---------------------------------------------------------------------------
@app.post(
    "/generate",
    response_model=BatchGenerateResponse,
    tags=["Subject Lines"],
    summary="Generate subject lines for a batch of leads",
)
async def generate(request: BatchGenerateRequest):
    """
    Accepts a list of leads (1–N) and returns subject line results for each.
    Each lead gets:
    - 5 subject line variations (Curious, Urgent, Friendly, Professional, Bold)
    - A score per variation
    - The best_subject (highest scoring)
    - Processing metadata

    Leads are processed sequentially.  Results are returned in the same order
    as the input.
    """
    leads_dicts = [lead.to_dict() for lead in request.leads]
    logger.info("/generate: received %d lead(s)", len(leads_dicts))

    started = time.monotonic()
    try:
        run_pipeline = _get_pipeline()
        raw_results = run_pipeline(leads_dicts)
    except Exception as exc:
        logger.error("/generate: pipeline error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Subject line pipeline failed: {exc}",
        ) from exc

    elapsed = int((time.monotonic() - started) * 1000)
    logger.info("/generate: processed %d lead(s) in %dms", len(leads_dicts), elapsed)

    # Convert TypedDict results to Pydantic models for serialisation
    results = [_typeddict_to_lead_result(r) for r in raw_results]

    return BatchGenerateResponse(
        success=True,
        total=len(results),
        results=results,
    )


# ---------------------------------------------------------------------------
# POST /subject-lines — drop-in replacement for Node.js endpoint
# ---------------------------------------------------------------------------
@app.post(
    "/subject-lines",
    response_model=SubjectLineResponse,
    tags=["Subject Lines"],
    summary="Generate subject lines (drop-in for Node.js /api/ai/subject-lines)",
)
async def subject_lines(request: SubjectLineRequest):
    """
    Brief-mode endpoint that matches the exact Node.js response shape
    (`{ subjects, subjectLines }`) so the frontend can consume it without changes.

    Accepts either:
    - A `brief` + `industry` + `targetRole` + `country` + `tone` (single synthetic lead)
    - An explicit `leads` array (one or more real leads)

    When multiple leads are provided, the response contains:
    - `subjectLines` / `subjects`: from the **best** lead (or aggregated best)
    - `results`: per-lead detail for all leads
    """
    # Build the leads list to process
    if request.leads:
        leads_dicts = [lead.to_dict() for lead in request.leads]
    else:
        # Synthesise a lead from the brief fields
        leads_dicts = [_brief_to_lead(request)]

    logger.info("/subject-lines: processing %d lead(s)", len(leads_dicts))

    started = time.monotonic()
    try:
        run_pipeline = _get_pipeline()
        raw_results = run_pipeline(leads_dicts)
    except Exception as exc:
        logger.error("/subject-lines: pipeline error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Subject line pipeline failed: {exc}",
        ) from exc

    elapsed = int((time.monotonic() - started) * 1000)
    logger.info("/subject-lines: done in %dms", elapsed)

    # Convert TypedDict → Pydantic
    pydantic_results = [_typeddict_to_lead_result(r) for r in raw_results]

    # --- Build Node.js-compatible top-level shape ---
    # Use the best subject line across all leads as the primary result
    # (for single-lead this is just that lead's best; for multi it's the top scorer)
    all_subjects_flat: list[SubjectLineEntry] = []
    for r in pydantic_results:
        all_subjects_flat.extend(r.all_subjects)

    # Sort by score desc, deduplicate by text
    seen: set[str] = set()
    top_subjects: list[SubjectLineEntry] = []
    for s in sorted(all_subjects_flat, key=lambda x: x.score, reverse=True):
        key = s.subject.lower()
        if key not in seen:
            seen.add(key)
            top_subjects.append(s)

    # Take up to 5 for the legacy shape (Node.js expects exactly 5)
    top_five = top_subjects[:5]

    # Node.js legacy shape: subjectLines (score 1–10), subjects (score 0–1)
    subject_lines_legacy = [
        SubjectLineVariant(
            style=s.style,
            subject=s.subject,
            score=round(s.score, 1),  # already 1–10
            reason=s.reason,
        )
        for s in top_five
    ]

    subjects_canonical = [
        SubjectLineCanonical(
            text=s.subject,
            score=round(min(1.0, max(0.0, s.score / 10.0)), 3),
        )
        for s in top_five
    ]

    return SubjectLineResponse(
        success=True,
        subjectLines=subject_lines_legacy,
        subjects=subjects_canonical,
        results=pydantic_results if len(pydantic_results) > 1 else None,
    )


# ---------------------------------------------------------------------------
# POST /prompt — Node.js SUBJECT_AI_ENDPOINT bridge
# ---------------------------------------------------------------------------
@app.post(
    "/prompt",
    tags=["Subject Lines"],
    summary="Raw prompt pass-through for Node.js SUBJECT_AI_ENDPOINT",
)
async def prompt_endpoint(request: PromptRequest):
    """
    This is the endpoint Node.js calls when SUBJECT_AI_ENDPOINT is set.

    The Node.js `subjectLineHttp.provider.js` sends:
        POST { "prompt": "<full assembled prompt string>" }

    We forward the prompt directly to Qwen and return raw JSON text in the
    format that `parseSubjectResponseToNormalized` in Node.js can parse:
        { "subjectLines": [{ "subject": "...", "style": "...", "score": 8, "reason": "..." }] }

    The response is returned as plain text (not wrapped in a JSON envelope)
    because `rawText` from the provider is fed directly into `parseJsonLoose()`.
    """
    import json as _json
    import re as _re
    # from langchain_ollama import ChatOllama
    from utils.llm_factory import get_llm
    from fastapi.responses import PlainTextResponse

    logger.info("/prompt: received prompt (%d chars)", len(request.prompt))

    # llm = ChatOllama(model=MODEL_NAME, temperature=0.7, format="")
    llm = get_llm(temperature=0.7)

    system_msg = (
        "system",
        (
            "You are an expert email copywriter. "
            "Follow the user's instructions exactly and return ONLY valid JSON. "
            "No markdown, no explanation, no code fences."
        ),
    )
    user_msg = ("human", request.prompt)

    raw_output = ""
    for attempt in range(2):
        try:
            resp = llm.invoke([system_msg, user_msg])
            raw_output = resp.content.strip()

            # Verify it's parseable and has subject lines
            match = _re.search(r'\{[\s\S]*\}', raw_output)
            if not match:
                raise ValueError("No JSON block found in response")
            data = _json.loads(match.group(0))
            if not (
                isinstance(data.get("subjectLines"), list) or
                isinstance(data.get("subjects"), list) or
                isinstance(data.get("variants"), list)
            ):
                raise ValueError("No subject array in response")

            # Return only the JSON block (Node.js parser uses parseJsonLoose)
            logger.info("/prompt: success on attempt %d", attempt + 1)
            return PlainTextResponse(content=match.group(0), media_type="application/json")

        except Exception as exc:
            logger.warning("/prompt: attempt %d failed: %s", attempt + 1, exc)
            if attempt == 0:
                # Retry with stricter instruction
                user_msg = (
                    "human",
                    request.prompt
                    + "\n\nCRITICAL: Return ONLY raw JSON. No markdown. No explanation.",
                )

    # Both attempts failed — return a deterministic fallback in the expected shape
    logger.error("/prompt: both attempts failed, returning fallback")
    fallback = _json.dumps({
        "subjectLines": [
            {"style": "Curious",      "subject": "A quick thought on your workflow",  "score": 6, "reason": "Fallback"},
            {"style": "Urgent",       "subject": "Time-sensitive idea for your team",  "score": 6, "reason": "Fallback"},
            {"style": "Friendly",     "subject": "Something worth a quick look",       "score": 6, "reason": "Fallback"},
            {"style": "Professional", "subject": "A relevant update for your team",    "score": 6, "reason": "Fallback"},
            {"style": "Bold",         "subject": "Worth your attention this week",     "score": 6, "reason": "Fallback"},
        ]
    })
    return PlainTextResponse(content=fallback, media_type="application/json")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _brief_to_lead(request: SubjectLineRequest) -> dict[str, Any]:
    """Convert brief-mode request fields into a synthetic lead dict."""
    return {
        "email": f"brief@{request.industry.lower().replace(' ', '-') or 'moxsend'}.com",
        "firstname": "",
        "lastname": "",
        "phone": "",
        "company": request.brief or request.industry or "company",
        "companyurl": "",
        "city": "",
        "country": request.country,
        "designation": request.targetRole,
        "industry": request.industry,
        "company_size": "",
        "lead_type": "",
        "source": "brief_mode",
        "tags": request.tone,
        "notes": request.brief,
    }


def _typeddict_to_lead_result(r: dict[str, Any]) -> LeadResult:
    """Convert a TypedDict LeadResult to a Pydantic LeadResult for serialisation."""
    best = r.get("best_subject", {})
    meta = r.get("meta", {})
    all_subs = r.get("all_subjects", [])

    return LeadResult(
        email=str(r.get("email", "")),
        best_subject=SubjectLineEntry(
            subject=str(best.get("subject", "")),
            style=str(best.get("style", "General")),
            score=float(best.get("score", 1.0)),
            reason=str(best.get("reason", "")),
        ),
        all_subjects=[
            SubjectLineEntry(
                subject=str(s.get("subject", "")),
                style=str(s.get("style", "General")),
                score=float(s.get("score", 1.0)),
                reason=str(s.get("reason", "")),
            )
            for s in all_subs
        ],
        meta=LeadMeta(
            processing_time_ms=int(meta.get("processing_time_ms", 0)),
            model=str(meta.get("model", MODEL_NAME)),
            status=str(meta.get("status", "unknown")),
            error=meta.get("error"),
        ),
    )


# ---------------------------------------------------------------------------
# POST /personalize-email  (replaces /api/groq/personalize-email)
# ---------------------------------------------------------------------------
@app.post(
    "/personalize-email",
    tags=["Email Personalization"],
    summary="Generate a personalized cold email using Qwen (replaces Groq/Gemini)",
)
async def personalize_email(request: PersonalizeEmailRequest):
    """
    Accepts the exact same payload as the Next.js /api/groq/personalize-email route
    and returns the exact same response shape.

    The Next.js model router (ai/model/index.ts) forwards here when
    PERSONALIZE_AI_ENDPOINT is set.
    """
    import time as _time
    request_id = str(_uuid.uuid4())
    trace_id = str(_uuid.uuid4())
    started = _time.monotonic()

    _log_event("REQUEST_RECEIVED", "RETRYING", request_id, trace_id,
               job_id=request.jobId, provider="qwen")

    try:
        from moxsend_graph.nodes.personalize_email import generate_personalized_email

        result = generate_personalized_email(
            offer=request.offer,
            length=request.length,
            personalize_keys=request.personalizeKeys,
            extra_instructions=request.extraInstructions,
            sample_row=request.sampleRow,
            variant_label=request.variantLabel,
            cohort_rows=request.cohortRows,
        )

        elapsed_ms = int((_time.monotonic() - started) * 1000)

        _log_event(
            "GENERATION_COMPLETED", "SUCCESS", request_id, trace_id,
            job_id=request.jobId, processing_time_ms=elapsed_ms,
        )

        tel = PersonalizeTelemetry(
            traceId=trace_id,
            requestId=request_id,
            status="SUCCESS",
            processingTimeMs=elapsed_ms,
            provider="qwen",
            model=MODEL_NAME,
            retryCount=0,
            variantLabel=request.variantLabel,
        )

        return PersonalizeEmailResponse(
            ok=True,
            subject=result["subject"],
            body=result["body"],
            personalization_score=result["personalization_score"],
            cultural_fit_score=result["cultural_fit_score"],
            reply_likelihood_score=result["reply_likelihood_score"],
            language_mode=result["language_mode"],
            reasoning_summary=result["reasoning_summary"],
            telemetry=tel,
        )

    except Exception as exc:
        elapsed_ms = int((_time.monotonic() - started) * 1000)
        logger.error("/personalize-email error: %s", exc, exc_info=True)
        _log_event(
            "GENERATION_FAILED", "FAILED", request_id, trace_id,
            job_id=request.jobId,
            processing_time_ms=elapsed_ms,
            error_message=str(exc)[:500],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Email generation failed: {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# GET /ai-generation-logs  (replaces Next.js Supabase route)
# ---------------------------------------------------------------------------
@app.get(
    "/ai-generation-logs",
    tags=["Observability"],
    summary="List recent AI generation log events (in-memory store)",
)
async def ai_generation_logs(limit: int = 40, job_id: str | None = None):
    """
    Returns the same shape as the Next.js /api/ai-generation-logs route.
    Data is sourced from the in-memory log store accumulated during this
    server session (not persisted across restarts).
    """
    cap = min(80, max(1, limit))
    all_logs = list(_AI_GENERATION_LOGS)  # oldest → newest
    all_logs.reverse()  # newest first to match Supabase ORDER BY created_at DESC

    if job_id:
        filtered = [l for l in all_logs if l.get("job_id") == job_id]
    else:
        filtered = [l for l in all_logs if not l.get("job_id")]

    return {
        "ok": True,
        "configured": True,
        "items": filtered[:cap],
    }


# ---------------------------------------------------------------------------
# GET + POST /ai-personalize-saves  (replaces Next.js Supabase route)
# ---------------------------------------------------------------------------
@app.get(
    "/ai-personalize-saves",
    tags=["Observability"],
    summary="List saved personalize-email generations (in-memory store)",
)
async def get_personalize_saves():
    """Returns the same shape as the Next.js GET /api/ai-personalize-saves route."""
    items = list(reversed(_AI_PERSONALIZE_SAVES))  # newest first
    return {"ok": True, "configured": True, "items": items[:80]}


@app.post(
    "/ai-personalize-saves",
    tags=["Observability"],
    summary="Save a personalize-email generation (in-memory store)",
)
async def post_personalize_saves(request: AiPersonalizeSaveRequest):
    """Returns the same shape as the Next.js POST /api/ai-personalize-saves route."""
    if not request.offer.strip():
        raise HTTPException(status_code=400, detail="offer is required")
    if not request.subjectA.strip():
        raise HTTPException(status_code=400, detail="subjectA is required")
    if not request.bodyHtmlA.strip():
        raise HTTPException(status_code=400, detail="bodyHtmlA is required")
    if request.emailLength not in ("short", "medium", "long"):
        raise HTTPException(status_code=400, detail="emailLength must be short, medium, or long")

    new_id = str(_uuid.uuid4())
    row = {
        "id": new_id,
        "created_at": _now_iso(),
        "import_job_id": request.importJobId,
        "reference_lead_email": request.referenceLeadEmail,
        "reference_display": request.referenceDisplay,
        "selected_lead_count": max(0, request.selectedLeadCount),
        "offer": request.offer.strip(),
        "extra_instructions": request.extraInstructions or "",
        "email_length": request.emailLength,
        "personalize_keys": request.personalizeKeys,
        "ab_enabled": request.abEnabled,
        "subject_a": request.subjectA.strip(),
        "body_html_a": request.bodyHtmlA.strip(),
        "subject_b": request.subjectB.strip() if request.abEnabled and request.subjectB else None,
        "body_html_b": request.bodyHtmlB.strip() if request.abEnabled and request.bodyHtmlB else None,
    }
    _AI_PERSONALIZE_SAVES.append(row)
    return {"ok": True, "saved": {"id": new_id, "created_at": row["created_at"]}}


# ---------------------------------------------------------------------------
# POST /personalize-email-prompt  (TypeScript ai/model/index.ts bridge)
# ---------------------------------------------------------------------------
@app.post(
    "/personalize-email-prompt",
    tags=["Email Personalization"],
    summary="Raw prompt forwarding — called by ai/model/index.ts when PERSONALIZE_AI_ENDPOINT is set",
)
async def personalize_email_prompt(request: PromptRequest):
    """
    Accepts { "prompt": "<full buildPersonalizeEmailPrompt() output>" } from the
    TypeScript model router (ai/model/index.ts generateJsonWithMeta).

    Passes the prompt directly to Qwen and returns a JSON object in the exact
    GeminiOut shape the Next.js personalize-email route expects:
    {
      "subject": "...",
      "body": "<HTML>",
      "personalization_score": 88,
      "cultural_fit_score": 85,
      "reply_likelihood_score": 82,
      "language_mode": "en",
      "reasoning_summary": "..."
    }

    This is a plain prompt pass-through — no LangGraph graph overhead — because
    the TypeScript layer has already assembled a high-quality, context-rich prompt.
    """
    import json as _json
    import re as _re
    import time as _time
    # from langchain_ollama import ChatOllama
    from utils.llm_factory import get_llm

    logger.info("/personalize-email-prompt: received prompt (%d chars)", len(request.prompt))
    started = _time.monotonic()

    # llm = ChatOllama(model=MODEL_NAME, temperature=0.7, format="")
    llm = get_llm(temperature=0.7)

    system_msg = (
        "system",
        (
            "You are an elite B2B outbound operator. Never write like a SaaS marketer. "
            "Follow the instructions exactly. Return ONLY valid JSON — no markdown, no explanation, no code fences."
        ),
    )

    expected_keys = {"subject", "body", "personalization_score", "cultural_fit_score",
                     "reply_likelihood_score", "language_mode", "reasoning_summary"}

    for attempt in range(2):
        try:
            extra = "\n\nCRITICAL: Return ONLY the raw JSON object. No markdown. No code fences." if attempt == 1 else ""
            user_msg = ("human", request.prompt + extra)
            resp = llm.invoke([system_msg, user_msg])
            raw = resp.content.strip()

            # Strip markdown fences
            raw = _re.sub(r'^```(?:json)?\s*', '', raw)
            raw = _re.sub(r'\s*```$', '', raw)

            match = _re.search(r'\{[\s\S]*\}', raw)
            if not match:
                raise ValueError("No JSON object in response")

            data = _json.loads(match.group(0))

            subject = str(data.get("subject", "")).strip()
            body = str(data.get("body", "")).strip()
            if not subject or not body:
                raise ValueError("Empty subject or body")

            elapsed_ms = int((_time.monotonic() - started) * 1000)
            logger.info(
                "/personalize-email-prompt: success (attempt %d) in %dms subject=%r",
                attempt + 1, elapsed_ms, subject,
            )

            # Return the full GeminiOut-compatible dict
            return {
                "subject": subject,
                "body": body,
                "personalization_score": int(data.get("personalization_score") or 0),
                "cultural_fit_score": int(data.get("cultural_fit_score") or 0),
                "reply_likelihood_score": int(data.get("reply_likelihood_score") or 0),
                "language_mode": str(data.get("language_mode") or "en"),
                "reasoning_summary": str(data.get("reasoning_summary") or ""),
            }

        except Exception as exc:
            logger.warning("/personalize-email-prompt: attempt %d failed: %s", attempt + 1, exc)

    # Both attempts failed — raise so TypeScript falls back to Groq
    elapsed_ms = int((_time.monotonic() - started) * 1000)
    logger.error("/personalize-email-prompt: both attempts failed after %dms — falling back to Groq", elapsed_ms)
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Qwen personalize-email-prompt failed after 2 attempts — TypeScript will fall back to Groq.",
    )


# ---------------------------------------------------------------------------
# POST /rewrite  (replaces /api/gemini/rewrite)
# ---------------------------------------------------------------------------
@app.post(
    "/rewrite",
    tags=["Email Tools"],
    summary="Rewrite subject or body text using Qwen (replaces Groq/Gemini)",
)
async def rewrite_text(request: Request):
    """
    Accepts { "prompt": "...", "temperature": 0.7, "maxOutputTokens": 8192 }
    and returns { "text": "..." }.

    Called by ai/model/index.ts generateText() when REWRITE_AI_ENDPOINT is set.
    """
    import json as _json
    import re as _re
    import time as _time
    # from langchain_ollama import ChatOllama
    from utils.llm_factory import get_llm

    body = await request.json()
    prompt = str(body.get("prompt", "")).strip()
    temperature = float(body.get("temperature", 0.7))
    max_tokens = int(body.get("maxOutputTokens", 8192))

    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    logger.info("/rewrite: received prompt (%d chars, temp=%.2f)", len(prompt), temperature)
    started = _time.monotonic()

    # llm = ChatOllama(model=MODEL_NAME, temperature=temperature, num_predict=max_tokens)
    llm = get_llm(temperature=temperature, max_tokens=max_tokens)

    system_msg = (
        "system",
        "You are a world-class B2B email copywriter. Follow instructions precisely. "
        "Return ONLY the rewritten text — no explanations, no preamble, no markdown fences.",
    )

    for attempt in range(2):
        try:
            extra = "\n\nIMPORTANT: Return ONLY the rewritten text. Nothing else." if attempt == 1 else ""
            user_msg = ("human", prompt + extra)
            resp = llm.invoke([system_msg, user_msg])
            text = resp.content.strip()

            # Strip markdown code fences if present
            text = _re.sub(r'^```(?:\w*)\s*', '', text)
            text = _re.sub(r'\s*```$', '', text)
            text = text.strip()

            if not text:
                raise ValueError("Empty response from model")

            elapsed_ms = int((_time.monotonic() - started) * 1000)
            logger.info("/rewrite: success (attempt %d) in %dms (%d chars)", attempt + 1, elapsed_ms, len(text))

            return {"ok": True, "text": text}

        except Exception as exc:
            logger.warning("/rewrite: attempt %d failed: %s", attempt + 1, exc)

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Rewrite failed after 2 attempts",
    )


# ---------------------------------------------------------------------------
# POST /translate-ar  (replaces /api/gemini/translate-ar)
# ---------------------------------------------------------------------------
@app.post(
    "/translate-ar",
    tags=["Email Tools"],
    summary="Translate email to Arabic using Qwen (replaces Groq/Gemini)",
)
async def translate_ar(request: Request):
    """
    Accepts { "prompt": "..." } and returns { "subject": "...", "bodyHtml": "..." }.

    Called by ai/model/index.ts generateJson() when TRANSLATE_AI_ENDPOINT is set.
    """
    import json as _json
    import re as _re
    import time as _time
    # from langchain_ollama import ChatOllama
    from utils.llm_factory import get_llm

    body = await request.json()
    prompt = str(body.get("prompt", "")).strip()

    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    logger.info("/translate-ar: received prompt (%d chars)", len(prompt))
    started = _time.monotonic()

    # llm = ChatOllama(model=MODEL_NAME, temperature=0.3, format="")
    llm = get_llm(temperature=0.3)

    system_msg = (
        "system",
        "You are a professional Arabic translator specializing in B2B business emails. "
        "Translate the content to Modern Standard Arabic while maintaining HTML formatting. "
        "Return ONLY valid JSON with keys 'subject' and 'bodyHtml'. No markdown fences.",
    )

    for attempt in range(2):
        try:
            extra = "\n\nCRITICAL: Return ONLY the raw JSON object. No markdown." if attempt == 1 else ""
            user_msg = ("human", prompt + extra)
            resp = llm.invoke([system_msg, user_msg])
            raw = resp.content.strip()

            # Strip markdown fences
            raw = _re.sub(r'^```(?:json)?\s*', '', raw)
            raw = _re.sub(r'\s*```$', '', raw)

            match = _re.search(r'\{[\s\S]*\}', raw)
            if not match:
                raise ValueError("No JSON object in response")

            data = _json.loads(match.group(0))
            subject = str(data.get("subject", "")).strip()
            body_html = str(data.get("bodyHtml", data.get("body_html", ""))).strip()

            if not subject and not body_html:
                raise ValueError("Empty subject and bodyHtml")

            elapsed_ms = int((_time.monotonic() - started) * 1000)
            logger.info("/translate-ar: success (attempt %d) in %dms", attempt + 1, elapsed_ms)

            return {"ok": True, "subject": subject, "bodyHtml": body_html}

        except Exception as exc:
            logger.warning("/translate-ar: attempt %d failed: %s", attempt + 1, exc)

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Arabic translation failed after 2 attempts",
    )


# ---------------------------------------------------------------------------
# POST /personalize-email-batch  (per-lead unique content generation)
# ---------------------------------------------------------------------------
@app.post(
    "/personalize-email-batch",
    tags=["Email Personalization"],
    summary="Generate unique personalized emails for each lead in a batch",
)
async def personalize_email_batch(request: Request):
    """
    Accepts a list of leads and generates a unique subject + body for EACH lead.
    Returns a map of email → result so the frontend can toggle between leads.

    Request:
    {
      "offer": "Selling CRM for SMBs",
      "length": "medium",
      "personalizeKeys": ["name", "company"],
      "extraInstructions": "",
      "variantLabel": "A",
      "leads": [
        {"email": "jane@acme.com", "firstname": "Jane", "company": "Acme", ...},
        {"email": "bob@globex.com", "firstname": "Bob", "company": "Globex", ...}
      ]
    }

    Response:
    {
      "ok": true,
      "results": {
        "jane@acme.com": {
          "subject": "...",
          "body": "<p>...</p>",
          "personalization_score": 88,
          ...
        },
        "bob@globex.com": { ... }
      }
    }
    """
    import time as _time

    body = await request.json()
    offer = str(body.get("offer", "")).strip()
    length = str(body.get("length", "medium")).strip()
    personalize_keys = body.get("personalizeKeys", ["name", "company"])
    extra_instructions = str(body.get("extraInstructions", ""))
    variant_label = str(body.get("variantLabel", "A"))
    leads = body.get("leads", [])

    if not offer:
        raise HTTPException(status_code=400, detail="offer is required")
    if not leads or not isinstance(leads, list):
        raise HTTPException(status_code=400, detail="leads must be a non-empty array")
    if len(leads) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 leads per batch")

    logger.info("/personalize-email-batch: processing %d leads", len(leads))
    started = _time.monotonic()

    from moxsend_graph.nodes.personalize_email import generate_personalized_email

    results: dict[str, Any] = {}
    errors: list[str] = []

    for i, lead in enumerate(leads):
        email = str(lead.get("email", f"lead-{i}")).strip()
        try:
            result = generate_personalized_email(
                offer=offer,
                length=length,
                personalize_keys=personalize_keys,
                extra_instructions=extra_instructions,
                sample_row=lead,
                variant_label=variant_label,
                cohort_rows=leads,  # full cohort context
            )
            results[email] = result
            logger.info(
                "  [%d/%d] %s → subject=%r",
                i + 1, len(leads), email, result["subject"],
            )
        except Exception as exc:
            logger.warning("  [%d/%d] %s → FAILED: %s", i + 1, len(leads), email, exc)
            errors.append(f"{email}: {exc}")
            # Provide a deterministic fallback so the frontend still works
            results[email] = {
                "subject": f"{{{{name}}}}: a quick thought for your team",
                "body": f"<p>Hi {{{{name}}}},</p><p>I noticed {{{{company}}}} might benefit from {offer}. Worth a quick look?</p>",
                "personalization_score": 50,
                "cultural_fit_score": 50,
                "reply_likelihood_score": 50,
                "language_mode": "en",
                "reasoning_summary": f"Fallback — generation failed: {exc}",
            }

    elapsed_ms = int((_time.monotonic() - started) * 1000)
    logger.info(
        "/personalize-email-batch: done in %dms (%d ok, %d fallback)",
        elapsed_ms, len(results) - len(errors), len(errors),
    )

    return {
        "ok": True,
        "results": results,
        "processing_time_ms": elapsed_ms,
        "total": len(leads),
        "succeeded": len(results) - len(errors),
        "failed": len(errors),
        "errors": errors if errors else None,
    }


# ---------------------------------------------------------------------------
# Direct run (python api/main.py)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8001, reload=True)
