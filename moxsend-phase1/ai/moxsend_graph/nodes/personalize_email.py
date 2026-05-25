"""
LangGraph Node: personalize_email

Generates a personalized cold email (subject + HTML body) for a B2B lead
using Qwen via Groq.

Translates the TypeScript buildPersonalizeEmailPrompt() logic to Python,
accepts the exact same request payload the Next.js frontend sends, and
returns the exact same JSON shape.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)

MODEL_NAME = "qwen2.5:7b"

FORBIDDEN_PHRASES = [
    'accelerate growth', 'maximize efficiency', 'streamline operations', 'innovative solution', 
    'cutting-edge', 'seamless experience', 'boost productivity', 'transform your business', 
    'AI-powered', 'operational excellence', 'stakeholder alignment', 'workflow optimization',
    'We provide...', 'You can leverage...'
]

def length_guidance(length: str) -> str:
    if length == 'short':
        return 'Body: 2–3 short paragraphs total. Tight and scannable.'
    elif length == 'medium':
        return 'Body: about 3–4 paragraphs. Balanced detail.'
    elif length == 'long':
        return 'Body: 5–7 short paragraphs. Richer context, still respectful of time.'
    return ''

def _build_prompt(
    offer: str,
    length: str,
    personalize_keys: list[str],
    extra_instructions: str,
    sample_row: dict[str, Any],
    variant_label: str,
    cohort_rows: Optional[list[dict[str, Any]]] = None,
) -> str:
    """Translate buildPersonalizeEmailPrompt() from TypeScript to Python."""
    name = f"{sample_row.get('firstname', '')} {sample_row.get('lastname', '')}".strip() or sample_row.get("name", "—")
    company = str(sample_row.get("company", "") or "—").strip()
    role = str(sample_row.get("designation", "") or sample_row.get("role", "") or "—").strip()

    audience = f"Name: {name}\nCompany: {company}\nRole: {role}"
    cohort = f"Cohort: {len(cohort_rows)} contacts." if cohort_rows and len(cohort_rows) > 1 else ""
    tags = ", ".join(f"{{{{{k}}}}}" for k in personalize_keys)
    instr = extra_instructions.strip()

    variant_desc = "Observational, diagnosing bottleneck" if variant_label == "A" else "Focus on hidden business consequence"
    
    extra_instr_part = f"Extra instructions:\n{instr}\n" if instr else ""
    length_rule = length_guidance(length)
    
    prompt = f"""You are an elite B2B outbound operator. Never write like a SaaS marketer.
Variant: {variant_desc}.
Offer: {offer}
Target: {audience}
{cohort}
Use ONLY these tags: {tags}
{extra_instr_part}
RULES:
1. ANTI-TEMPLATE: Implied context, no robotic personalization ("As a {{{{role}}}} at {{{{company}}}}").
2. CONCRETE: "requests and approvals" over "operational complexity".
3. OBSERVATIONAL: Sound human. "Things start slowing down...".
4. NO JARGON: Avoid: {', '.join(FORBIDDEN_PHRASES)}.
5. STRUCTURE: Exactly 4 short paragraphs.
   - P1: Specific workflow bottleneck (1-2 sentences).
   - P2: Hidden consequence (1-2 sentences).
   - P3: Practical outcome (no pitch/feature dump).
   - P4: Soft CTA ("Could be relevant depending on how {{{{company}}}} handles this.").
6. SUBJECT: < 7 words. Natural, curiosity-driven (e.g., "Campaign updates get scattered"). MUST match email body domain.
7. GCC LOCALIZATION: If UAE, tone is agile/scaling. If Saudi Arabia, tone is enterprise/compliance. IMPORTANT: ALWAYS WRITE IN ENGLISH unless the extra instructions explicitly request Arabic.
8. LENGTH: {length_rule}

JSON FORMAT:
{{
  "subject": "<string>",
  "body": "<HTML fragment: <p>, <br>. Single line string!>",
  "personalization_score": <number 0-100>,
  "cultural_fit_score": <number 0-100>,
  "reply_likelihood_score": <number 0-100>,
  "language_mode": "<string>",
  "reasoning_summary": "<string>"
}}
Return JSON only."""

    return prompt


def _extract_json(text: str) -> dict[str, Any]:
    """Extract and parse the first JSON object from LLM output."""
    cleaned = text.strip()
    # Strip markdown code fences if present
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    # Find the first { ... } block
    match = re.search(r'\{[\s\S]*\}', cleaned)
    if not match:
        raise ValueError("No JSON object found in response")
    return json.loads(match.group(0))


def _ensure_merge_tag(subject: str, personalize_keys: list[str]) -> str:
    """Ensure subject has at least one merge tag."""
    clean = " ".join(subject.split()).strip()
    if not clean:
        return "{{name}}: quick thought for your team"
    # Already has a merge tag
    if re.search(r'\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}', clean):
        return clean
    # Prepend preferred merge tag
    preferred = "{{name}}" if "name" in personalize_keys else (
        "{{company}}" if "company" in personalize_keys else
        f"{{{{{personalize_keys[0]}}}}}" if personalize_keys else "{{name}}"
    )
    return f"{preferred}: {clean}"


def _trim_to_word_limit(text: str, max_words: int = 10) -> str:
    words = text.strip().split()
    return " ".join(words[:max_words])


def generate_personalized_email(
    offer: str,
    length: str,
    personalize_keys: list[str],
    extra_instructions: str,
    sample_row: dict[str, Any],
    variant_label: str,
    cohort_rows: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """
    Generate a personalized cold email using Qwen.
    Returns a dict with keys: subject, body, personalization_score,
    cultural_fit_score, reply_likelihood_score, language_mode, reasoning_summary.
    Raises ValueError if both attempts fail.
    from utils.llm_factory import get_llm
    llm = get_llm(temperature=0.7, json_mode=True)

    user_prompt = _build_prompt(
        offer=offer,
        length=length,
        personalize_keys=personalize_keys,
        extra_instructions=extra_instructions,
        sample_row=sample_row,
        variant_label=variant_label,
        cohort_rows=cohort_rows,
    )

    for attempt in range(2):
        try:
            # We pass the full prompt as a single human message to match exactly how the TS version works
            user_msg = ("human", user_prompt)
            resp = llm.invoke([user_msg])
            data = _extract_json(resp.content)

            subject_raw = str(data.get("subject", "")).strip()
            body = str(data.get("body", "")).strip()

            if not subject_raw or not body:
                raise ValueError(f"Empty subject or body in attempt {attempt + 1}")

            subject = _trim_to_word_limit(
                _ensure_merge_tag(subject_raw, personalize_keys),
                max_words=10,
            )

            logger.info(
                "personalize_email: success (attempt %d) subject=%r",
                attempt + 1, subject,
            )

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
            logger.warning("personalize_email: attempt %d failed: %s", attempt + 1, exc)

    raise ValueError("Email personalization failed after 2 attempts")
    """
