import json
import logging
import re

from llm_handler.llm_handler import llm
from moxsend_graph.states.personalization_state import PersonalizationState

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior outbound email editor.
You refine an existing campaign base email for ONE specific lead.

You MUST preserve:
- campaign intent and CTA direction
- overall structure and section order

You MUST:
- Replace ALL placeholders/merge tags with the actual lead data.
- Ensure the tone is human-native: vary sentence length, use observational hooks, and avoid AI "politeness".
- Focus on SPECIFICITY based on the lead context.

Return ONLY strict JSON:
{ 
  "subject": "...", 
  "bodyHtml": "...",
  "personalization_reasoning": "Brief explanation of why this approach was used for this lead",
  "humanization_analysis": "Note on how the tone was adapted for realism"
}
bodyHtml must be valid HTML using <p> and <br/> only (no markdown)."""


def _extract_first_json(text: str) -> str:
    s = (text or "").strip()
    match = re.search(r"\{[\s\S]*\}", s)
    return match.group(0) if match else s


def refine_email_node(state: PersonalizationState) -> dict:
    base_email = str(state.get("base_email", "")).strip()
    base_subject = str(state.get("base_subject", "")).strip()
    refinement_prompt = str(state.get("refinement_prompt", "")).strip()
    lead = state.get("active_lead") or {}
    tone = str(state.get("tone", "Professional")).strip() or "Professional"

    if not base_email:
        raise RuntimeError("Missing base_email for refinement")
    if not refinement_prompt:
        raise RuntimeError("Missing refinement_prompt for refinement")

    lead_blob = json.dumps(lead, ensure_ascii=False)[:6000]
    user_prompt = f"""Refine the following base email for this lead.

Tone: {tone}

Lead context (JSON):
{lead_blob}

Base subject (plain text):
{base_subject}

Base email (HTML):
{base_email}

User refinement instruction:
{refinement_prompt}
"""

    try:
        prompt = f"{SYSTEM_PROMPT}\n\n{user_prompt}"
        model = state.get("model")
        cleaned = _extract_first_json(llm.generate_json(prompt, provider_name=model))
        data = json.loads(cleaned)

        subject = str(data.get("subject", "")).strip()
        body_html = str(data.get("bodyHtml", data.get("body", ""))).strip()
        if not subject or not body_html:
            raise ValueError("Model returned empty subject/bodyHtml")
            
        return {
            "refined_email": {
                "subject": subject, 
                "bodyHtml": body_html,
                "personalization_reasoning": data.get("personalization_reasoning", ""),
                "humanization_analysis": data.get("humanization_analysis", "")
            }
        }
    except Exception as e:
        logger.exception("Failed to refine email")
        raise RuntimeError(f"Failed to refine email: {e}") from e
