import logging
from typing import Any
from llm_handler.llm_handler import llm
from moxsend_graph.states.email_state import EmailState

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert B2B outbound operator.
Generate a single, highly converting base email.
Do NOT use placeholder tags like {name}, {company}, or [Name]. Use the provided lead data directly.
Write like a human: avoid robotic transitions, over-explaining, and corporate fluff.
Keep it punchy, observational, and low-pressure.
Return ONLY the email body as HTML using <p> and <br/> (no markdown, no code blocks)."""

def generate_base_email_node(state: EmailState) -> dict:
    leads = state.get("selected_leads", [])
    brief = state.get("campaign_brief", "")
    tone = state.get("tone", "Professional")
    
    # Use first lead as a reference for concrete examples if possible
    reference_lead = leads[0] if leads else {}
    ref_name = reference_lead.get("firstname", "there")
    ref_company = reference_lead.get("company", "your company")

    user_prompt = f"""Generate a base email body in HTML.
Tone: {tone}
Campaign Brief: {brief}
Example Recipient: {ref_name} at {ref_company}

Write a concise, compelling email body. Use the example recipient's info to ground the message, but keep it structured so it can be adapted easily.
DO NOT use brackets or braces for variables. Write the text naturally."""
    
    try:
        prompt = f"{SYSTEM_PROMPT}\n\n{user_prompt}"
        model = state.get("model")
        content = llm.generate(prompt, provider_name=model).strip()

        # Clean up markdown formatting if any
        if content.startswith("```"):
            lines = content.split('\n')
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            content = '\n'.join(lines).strip()
        
        if not content:
            raise RuntimeError("Groq returned empty email body")
        return {"generated_base_email": content}
    except Exception as e:
        logger.exception("Failed to generate base email")
        raise RuntimeError(f"Failed to generate base email: {e}") from e
