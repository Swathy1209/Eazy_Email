from typing import Any, TypedDict, List, Dict

class EmailState(TypedDict):
    campaign_brief: str
    selected_leads: List[Dict[str, Any]]
    tone: str
    market: str
    generated_base_email: str
    generated_subject_lines: List[Dict[str, Any]]
    metadata: Dict[str, Any]
