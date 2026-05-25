from typing import Any, Dict, List, Optional, TypedDict


class PersonalizationState(TypedDict, total=False):
    # ---- Inputs ----
    action: str  # "generate_base" | "refine_lead"
    campaign_id: str
    selected_leads: List[Dict[str, Any]]
    tone: str
    market: str
    campaign_brief: str
    email_length: str
    personalize_with: List[str]
    extra_instructions: str
    model: str


    # Refinement inputs
    base_email: str  # HTML
    base_subject: str
    base_subjects: List[Dict[str, Any]]
    active_lead_id: str
    active_lead: Dict[str, Any]
    refinement_prompt: str

    # ---- Outputs ----
    generated_base_email: str  # HTML
    generated_subject_lines: List[Dict[str, Any]]
    refined_email: Dict[str, str]  # {subject, bodyHtml}

    # ---- Metadata ----
    metadata: Dict[str, Any]
    errors: List[str]
