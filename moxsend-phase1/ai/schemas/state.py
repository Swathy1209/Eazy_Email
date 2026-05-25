from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class WorkflowState(BaseModel):
    lead_id: str
    language: str  # 'english' or 'arabic'
    lead_data: Dict[str, Any]
    personalization_context: Optional[Dict[str, Any]] = None
    narrative_context: Optional[Dict[str, Any]] = None
    generated_output: Optional[Dict[str, Any]] = None
    rewritten_output: Optional[Dict[str, Any]] = None
    evaluation_result: Optional[Dict[str, Any]] = None
    retry_count: int = 0
    logs: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}