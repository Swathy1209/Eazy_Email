"""
LangGraph StateGraph: Subject Line Pipeline

Wires together the four nodes for processing ONE lead at a time:
  validate_lead → generate_subjects → score_subjects → format_output

Public API:
  run_subject_pipeline(leads: list[dict]) -> list[LeadResult]

Handles any number of leads (1 to N). Each lead is processed sequentially
through the compiled graph. Results are collected and returned as a list.
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Optional
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, END

from moxsend_graph.states.subject_state import (
    SubjectGraphState,
    LeadInput,
    LeadResult,
    LeadMeta,
    SubjectLineEntry,
)
from moxsend_graph.nodes.generate_subjects import generate_subjects_node, MODEL_NAME
from moxsend_graph.nodes.score_subjects import score_subjects_node
from llm_handler.llm_handler import llm

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper nodes
# ---------------------------------------------------------------------------

def validate_lead_node(state: SubjectGraphState) -> dict:
    """
    Sanitise and normalise the lead dict before generation.
    Returns a cleaned lead (never fails — coerces missing fields to empty str).
    """
    raw: dict[str, Any] = state.get("lead", {}) or {}

    def _clean(key: str) -> str:
        return str(raw.get(key, "") or "").strip()

    cleaned = LeadInput(
        email=_clean("email"),
        firstname=_clean("firstname"),
        lastname=_clean("lastname"),
        phone=_clean("phone"),
        company=_clean("company"),
        companyurl=_clean("companyurl"),
        city=_clean("city"),
        country=_clean("country"),
        designation=_clean("designation"),
        industry=_clean("industry"),
        company_size=_clean("company_size"),
        lead_type=_clean("lead_type"),
        source=_clean("source"),
        tags=_clean("tags"),
        notes=_clean("notes"),
    )
    return {"lead": cleaned, "error": None}


def format_output_node(state: SubjectGraphState) -> dict:
    """
    No-op terminal node — the graph result IS the final state.
    We include this explicitly so the graph has a named terminal node.
    """
    return {}


# ---------------------------------------------------------------------------
# Graph compilation
# ---------------------------------------------------------------------------

def build_subject_graph() -> Any:
    """
    Compile and return the subject line StateGraph.

    Graph flow:
        validate_lead → generate_subjects → score_subjects → format_output → END
    """
    workflow = StateGraph(SubjectGraphState)

    workflow.add_node("validate_lead", validate_lead_node)
    workflow.add_node("generate_subjects", generate_subjects_node)
    workflow.add_node("score_subjects", score_subjects_node)
    workflow.add_node("format_output", format_output_node)

    workflow.set_entry_point("validate_lead")
    workflow.add_edge("validate_lead", "generate_subjects")
    workflow.add_edge("generate_subjects", "score_subjects")
    workflow.add_edge("score_subjects", "format_output")
    workflow.add_edge("format_output", END)

    return workflow.compile()


# Module-level compiled graph (singleton — compiled once, reused for all leads)
_graph = None


def _get_graph() -> Any:
    global _graph
    if _graph is None:
        _graph = build_subject_graph()
    return _graph


# ---------------------------------------------------------------------------
# Public API: batch runner
# ---------------------------------------------------------------------------

def run_subject_pipeline(leads: list[dict[str, Any]]) -> list[LeadResult]:
    """
    Process an arbitrary number of leads through the subject line graph.

    Args:
        leads: List of lead dicts — each must contain at minimum `email`.
               Extra fields are used to enrich the subject line generation.
               Missing fields are coerced to empty strings.

    Returns:
        List of LeadResult dicts, one per input lead, in the same order.
        If a lead fails entirely, its result has status='failed' and a fallback best_subject.
    """
    graph = _get_graph()
    results: list[LeadResult] = []

    for idx, lead in enumerate(leads):
        email = str(lead.get("email", "")).strip() or f"lead_{idx}"
        started_at = time.monotonic()

        logger.info("run_subject_pipeline: processing lead %d/%d (%s)", idx + 1, len(leads), email)

        try:
            initial_state: SubjectGraphState = {
                "lead": lead,  # type: ignore[typeddict-item]
                "raw_subjects": [],
                "scored_subjects": [],
                "best_subject": SubjectLineEntry(
                    subject="", style="", score=0.0, reason=""
                ),
                "error": None,
            }

            final_state: SubjectGraphState = graph.invoke(initial_state)

            elapsed_ms = int((time.monotonic() - started_at) * 1000)
            error_msg = final_state.get("error")

            scored: list[SubjectLineEntry] = final_state.get("scored_subjects", [])
            best: SubjectLineEntry = final_state.get("best_subject", SubjectLineEntry(
                subject="No subject generated",
                style="General",
                score=1.0,
                reason="Pipeline produced no output",
            ))

            result = LeadResult(
                email=email,
                best_subject=best,
                all_subjects=scored,
                meta=LeadMeta(
                    processing_time_ms=elapsed_ms,
                    model=MODEL_NAME,
                    status="failed" if error_msg and not scored else "success",
                    error=error_msg,
                ),
            )

        except Exception as exc:
            elapsed_ms = int((time.monotonic() - started_at) * 1000)
            logger.error(
                "run_subject_pipeline: unhandled error for lead %s: %s",
                email,
                exc,
                exc_info=True,
            )
            result = LeadResult(
                email=email,
                best_subject=SubjectLineEntry(
                    subject="Pipeline error — please retry",
                    style="General",
                    score=1.0,
                    reason=str(exc),
                ),
                all_subjects=[],
                meta=LeadMeta(
                    processing_time_ms=elapsed_ms,
                    model=MODEL_NAME,
                    status="failed",
                    error=str(exc),
                ),
            )

        results.append(result)
        logger.info(
            "run_subject_pipeline: lead %s done in %dms — best: '%s' (%.1f)",
            email,
            result["meta"]["processing_time_ms"],
            result["best_subject"]["subject"],
            result["best_subject"]["score"],
        )

    return results


# ===========================================================================
# Subject Optimizer Graph (Phase 1)
# ===========================================================================

class SubjectOptimizerState(TypedDict, total=False):
    subject_input: str
    campaign_context: str
    lead_context: str
    offer_context: str
    tone: str
    raw_variants: list[dict[str, Any]]
    scored_variants: list[dict[str, Any]]
    variants: list[dict[str, Any]]
    success: bool
    error: Optional[str]


_OPTIMIZER_ANGLES = [
    "curiosity gap",
    "urgency",
    "personalization",
    "enterprise relevance",
    "cultural fit",
]

_SPAMMY_TERMS = {
    "free",
    "guaranteed",
    "winner",
    "urgent",
    "act now",
    "limited time",
    "risk free",
    "profit",
    "cash",
    "deal",
    "discount",
}


def _clean_subject_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").replace('"', "").replace("`", "")).strip()


def _extract_json_block(text: str) -> str:
    match = re.search(r"\{[\s\S]*\}", text)
    return match.group(0) if match else text


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in re.findall(r"[a-z0-9']+", text or "") if t]


def _content_tokens(text: str) -> set[str]:
    stopwords = {
        "the",
        "and",
        "for",
        "with",
        "your",
        "this",
        "that",
        "from",
        "into",
        "what",
        "how",
        "why",
        "are",
        "you",
        "our",
        "team",
        "a",
        "an",
        "to",
        "of",
        "in",
        "on",
        "it",
        "is",
        "we",
        "can",
        "be",
    }
    return {token for token in _tokenize(text) if token not in stopwords and len(token) > 2}


def _extract_context_anchor(context: str) -> str:
    clean = _clean_subject_text(context)
    if not clean:
        return ""

    patterns = [
        r"Company:\s*([^|]+)",
        r"Role:\s*([^|]+)",
        r"Industry:\s*([^|]+)",
        r"Country:\s*([^|]+)",
        r"City:\s*([^|]+)",
        r"Name:\s*([^|]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, clean, re.IGNORECASE)
        if match:
            value = _clean_subject_text(match.group(1))
            if value:
                return value

    return clean.split("|")[0].strip()


def _label_for_score(score: int) -> str:
    if score >= 88:
        return "Best"
    if score >= 78:
        return "High"
    if score >= 68:
        return "Good"
    if score >= 58:
        return "Medium"
    return "Low"


def _build_optimizer_prompt(state: SubjectOptimizerState) -> str:
    subject_input = _clean_subject_text(state.get("subject_input", ""))
    campaign_context = _clean_subject_text(state.get("campaign_context", ""))
    lead_context = _clean_subject_text(state.get("lead_context", ""))
    offer_context = _clean_subject_text(state.get("offer_context", ""))
    tone = _clean_subject_text(state.get("tone", "")) or "Professional"

    context_lines = []
    if lead_context:
        context_lines.append(f"Lead details: {lead_context}")
    if offer_context:
        context_lines.append(f"Offer context: {offer_context}")
    if campaign_context:
        context_lines.append(f"Campaign context: {campaign_context}")
    context_block = "\n".join(context_lines) if context_lines else "No additional context provided."
    return f"""
You are a senior B2B subject-line strategist.

Task:
- Refine the current subject line into exactly 5 subject line variants.
- Use the current subject as the baseline, not a blank slate.
- Ground every variant in the specific lead details and the offer context.
- Keep every variant deliverability-safe, professional, and suitable for B2B outreach.
- Vary the angle across curiosity gap, urgency, personalization, enterprise relevance, and cultural fit.
- Keep the core idea intact. Do not drift into unrelated messaging.
- Prefer 4-9 words where possible.
- Avoid spammy phrasing, emojis, excessive punctuation, and clickbait.
- Return ONLY valid JSON. No markdown, no commentary.

Input subject idea:
{subject_input}

Context to respect:
{context_block}

Tone:
{tone}

Required JSON shape:
{{
  "variants": [
    {{
      "subject": "string",
      "angle": "string"
    }}
  ]
}}
""".strip()


def _parse_optimizer_variants(raw_text: str) -> list[dict[str, Any]]:
    cleaned = _extract_json_block(raw_text.strip())
    data = json.loads(cleaned)
    variants = data.get("variants") or data.get("subjectLines") or data.get("subjects")
    if not isinstance(variants, list):
        raise ValueError("No variants array found in response")

    parsed: list[dict[str, Any]] = []
    for index, item in enumerate(variants):
        if not isinstance(item, dict):
            continue
        subject = _clean_subject_text(item.get("subject") or item.get("text") or "")
        if not subject:
            continue
        angle = _clean_subject_text(item.get("angle") or item.get("reason") or item.get("style") or "")
        if not angle:
            angle = _OPTIMIZER_ANGLES[index % len(_OPTIMIZER_ANGLES)]
        parsed.append({"subject": subject, "angle": angle})

    if not parsed:
        raise ValueError("Parsed variants list is empty")

    return parsed[:5]


def _fallback_optimizer_variants(state: SubjectOptimizerState) -> list[dict[str, Any]]:
    subject_input = _clean_subject_text(state.get("subject_input", ""))
    campaign_context = _clean_subject_text(state.get("campaign_context", ""))
    lead_context = _clean_subject_text(state.get("lead_context", ""))
    offer_context = _clean_subject_text(state.get("offer_context", ""))
    tone = _clean_subject_text(state.get("tone", "")) or "Professional"

    core = subject_input
    if campaign_context:
        first_clause = campaign_context.split(".")[0].strip()
        if first_clause:
            core = f"{subject_input} - {first_clause}" if subject_input else first_clause

    lead_anchor = _extract_context_anchor(lead_context)
    offer_anchor = _extract_context_anchor(offer_context)
    enterprise_anchor = _extract_context_anchor(f"{lead_context} {offer_context} {campaign_context}")
    target_anchor = lead_anchor or enterprise_anchor or "your team"

    return [
        {"subject": core, "angle": "curiosity gap with a direct business hook"},
        {"subject": f"Quick idea for {target_anchor}" if subject_input else "Quick idea for your team", "angle": "urgency without sounding pushy"},
        {"subject": f"A more tailored take for {lead_anchor}" if lead_anchor else (f"A more tailored take on {subject_input}" if subject_input else "A more tailored take for your team"), "angle": "personalization with enterprise-safe phrasing"},
        {"subject": f"Enterprise-ready version for {offer_anchor}" if offer_anchor else (f"Enterprise-ready version: {subject_input}" if subject_input else f"Enterprise-ready version for a {tone.lower()} audience"), "angle": "enterprise relevance and clarity"},
        {"subject": f"Would this fit {target_anchor}?" if target_anchor else "Would this fit your team?", "angle": "cultural fit and reply-friendly framing"},
    ]


def _score_optimizer_variant(subject: str, angle: str, state: SubjectOptimizerState) -> dict[str, Any]:
    subject_input = _clean_subject_text(state.get("subject_input", ""))
    campaign_context = _clean_subject_text(state.get("campaign_context", ""))
    lead_context = _clean_subject_text(state.get("lead_context", ""))
    offer_context = _clean_subject_text(state.get("offer_context", ""))
    tone = _clean_subject_text(state.get("tone", "")) or "Professional"

    subject_norm = _clean_subject_text(subject)
    words = _tokenize(subject_norm)
    word_count = len(words)
    char_count = len(subject_norm)
    subject_tokens = _content_tokens(subject_norm)
    input_tokens = _content_tokens(f"{subject_input} {campaign_context} {lead_context} {offer_context}")
    token_overlap = len(subject_tokens & input_tokens)

    brevity = 100
    if word_count:
        brevity -= abs(word_count - 6) * 11
    brevity -= max(0, char_count - 58) * 1.3
    brevity -= max(0, 16 - char_count) * 1.0
    brevity = max(0, min(100, int(round(brevity))))

    clarity = 100
    clarity -= 10 * subject_norm.count("?")
    clarity -= 8 * subject_norm.count("!")
    clarity -= 8 if char_count > 70 else 0
    clarity -= 6 if len(set(words)) < max(2, len(words) // 2) else 0
    clarity = max(0, min(100, int(round(clarity))))

    curiosity = 24 if "?" in subject_norm else 0
    curiosity += 12 if any(token in subject_norm.lower() for token in ["how", "why", "what", "could", "would", "secret", "idea", "worth", "maybe"]) else 0
    curiosity += 10 if "gap" in angle.lower() or "curiosity" in angle.lower() else 0
    curiosity = max(0, min(100, curiosity + min(24, token_overlap * 8)))

    professionalism = 100
    professionalism -= 14 if any(term in subject_norm.lower() for term in _SPAMMY_TERMS) else 0
    professionalism -= 16 if subject_norm.isupper() and len(subject_norm) > 4 else 0
    professionalism -= 12 if "!" in subject_norm else 0
    professionalism -= 6 if any(ch.isdigit() for ch in subject_norm) else 0
    professionalism = max(0, min(100, professionalism))

    deliverability = 100
    deliverability -= 18 if any(term in subject_norm.lower() for term in _SPAMMY_TERMS) else 0
    deliverability -= 8 if subject_norm.count("!") > 0 else 0
    deliverability -= 8 if subject_norm.count("?") > 1 else 0
    deliverability -= 10 if char_count > 72 else 0
    deliverability -= 8 if subject_norm.isupper() and len(subject_norm) > 4 else 0
    deliverability = max(0, min(100, deliverability))

    open_rate = 100
    open_rate -= 12 if word_count < 4 else 0
    open_rate -= 10 if word_count > 10 else 0
    open_rate += 10 if token_overlap else 0
    open_rate += 8 if any(token in angle.lower() for token in ["curiosity", "urgency", "personalization", "enterprise", "cultural"]) else 0
    open_rate -= 10 if any(term in subject_norm.lower() for term in _SPAMMY_TERMS) else 0
    open_rate += 6 if offer_context and any(token in subject_norm.lower() for token in _content_tokens(offer_context)) else 0
    open_rate += 6 if lead_context and any(token in subject_norm.lower() for token in _content_tokens(lead_context)) else 0
    open_rate = max(0, min(100, open_rate))

    score = (
        open_rate * 0.24
        + clarity * 0.18
        + brevity * 0.16
        + curiosity * 0.16
        + professionalism * 0.16
        + deliverability * 0.10
    )
    score = max(0, min(100, int(round(score))))

    notes = []
    if token_overlap:
        notes.append("matches campaign language")
    if offer_context:
        notes.append("reflects the offer")
    if lead_context:
        notes.append("uses lead-specific framing")
    if curiosity >= 20:
        notes.append("creates an open loop")
    if brevity >= 80:
        notes.append("keeps inbox length tight")
    if professionalism >= 85:
        notes.append("reads as B2B-safe")
    if deliverability >= 85:
        notes.append("avoids spam-trigger phrasing")
    if not notes:
        notes.append("balanced optimization across clarity and curiosity")

    return {
        "subject": subject_norm,
        "angle": angle,
        "score": score,
        "label": _label_for_score(score),
        "reason": ", ".join(notes),
        "_metrics": {
            "open_rate": open_rate,
            "clarity": clarity,
            "brevity": brevity,
            "curiosity": curiosity,
            "professionalism": professionalism,
            "deliverability": deliverability,
        },
    }


def generate_subject_variants_node(state: SubjectOptimizerState) -> dict:
    subject_input = _clean_subject_text(state.get("subject_input", ""))
    if not subject_input:
        return {
            "raw_variants": [],
            "success": False,
            "error": "subject_input is required",
        }

    prompt = _build_optimizer_prompt(state)

    try:
        parsed = _parse_optimizer_variants(llm.generate_json(prompt))
        logger.info("generate_subject_variants_node: generated %d variants", len(parsed))
    except Exception as exc:
        logger.warning("generate_subject_variants_node: primary generation failed: %s", exc)
        try:
            parsed = _parse_optimizer_variants(
                llm.generate_json(
                    prompt
                    + "\n\nCRITICAL: Return only the raw JSON object with exactly 5 variants."
                )
            )
            logger.info("generate_subject_variants_node: recovered with stricter prompt")
        except Exception as exc2:
            logger.error("generate_subject_variants_node: falling back after failure: %s", exc2)
            parsed = _fallback_optimizer_variants(state)
            return {
                "raw_variants": parsed,
                "success": True,
                "error": None,
            }

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in parsed:
        key = item["subject"].lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    if len(deduped) < 5:
        for item in _fallback_optimizer_variants(state):
            key = item["subject"].lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
            if len(deduped) >= 5:
                break

    return {
        "raw_variants": deduped[:5],
        "success": True,
        "error": None,
    }


def score_subject_variants_node(state: SubjectOptimizerState) -> dict:
    variants = state.get("raw_variants", []) or []
    if not variants:
        return {
            "scored_variants": [],
            "success": False,
            "error": state.get("error") or "No subject variants available",
        }

    scored = [
        _score_optimizer_variant(str(item.get("subject", "")), str(item.get("angle", "")), state)
        for item in variants
        if _clean_subject_text(item.get("subject", ""))
    ]

    return {
        "scored_variants": scored,
    }


def rank_subject_variants_node(state: SubjectOptimizerState) -> dict:
    scored = state.get("scored_variants", []) or []
    if not scored:
        return {
            "variants": [],
            "success": False,
            "error": state.get("error") or "No scored variants available",
        }

    ranked = sorted(
        scored,
        key=lambda item: (
            int(item.get("score", 0)),
            int(item.get("_metrics", {}).get("open_rate", 0)),
            int(item.get("_metrics", {}).get("curiosity", 0)),
        ),
        reverse=True,
    )

    output: list[dict[str, Any]] = []
    for idx, item in enumerate(ranked[:5], start=1):
        score = int(item.get("score", 0))
        label = str(item.get("label") or _label_for_score(score))
        angle = str(item.get("angle", "")).strip()
        reason = str(item.get("reason", "")).strip()
        parts = [f"AI angle: {angle}." if angle else "AI angle: optimized for open-rate potential."]
        if reason:
            parts.append(reason)
        output.append(
            {
                "id": idx,
                "subject": str(item.get("subject", "")).strip(),
                "score": score,
                "label": label,
                "angle": " ".join(parts).strip(),
            }
        )

    return {
        "variants": output,
        "success": True,
        "error": None,
    }


def build_subject_optimizer_graph() -> Any:
    workflow = StateGraph(SubjectOptimizerState)

    workflow.add_node("generate_subject_variants", generate_subject_variants_node)
    workflow.add_node("score_subject_variants", score_subject_variants_node)
    workflow.add_node("rank_subject_variants", rank_subject_variants_node)

    workflow.set_entry_point("generate_subject_variants")
    workflow.add_edge("generate_subject_variants", "score_subject_variants")
    workflow.add_edge("score_subject_variants", "rank_subject_variants")
    workflow.add_edge("rank_subject_variants", END)

    return workflow.compile()


_subject_optimizer_graph = None


def _get_subject_optimizer_graph() -> Any:
    global _subject_optimizer_graph
    if _subject_optimizer_graph is None:
        _subject_optimizer_graph = build_subject_optimizer_graph()
    return _subject_optimizer_graph


def run_subject_optimizer(payload: dict[str, Any]) -> dict[str, Any]:
    subject_input = _clean_subject_text(payload.get("subject_input", ""))
    if not subject_input:
        return {
            "success": False,
            "error": "subject_input is required",
            "variants": [],
        }

    graph = _get_subject_optimizer_graph()
    initial_state: SubjectOptimizerState = {
        "subject_input": subject_input,
        "campaign_context": _clean_subject_text(payload.get("campaign_context", "")),
        "lead_context": _clean_subject_text(payload.get("lead_context", "")),
        "offer_context": _clean_subject_text(payload.get("offer_context", "")),
        "tone": _clean_subject_text(payload.get("tone", "")) or "Professional",
        "raw_variants": [],
        "scored_variants": [],
        "variants": [],
        "success": True,
        "error": None,
    }

    final_state: SubjectOptimizerState = graph.invoke(initial_state)
    return {
        "success": bool(final_state.get("success", True)) and not final_state.get("error"),
        "error": final_state.get("error"),
        "variants": final_state.get("variants", []),
    }
