from pydantic import BaseModel
from typing import List, Dict, Any

class EvaluationResult(BaseModel):
    approved: bool
    score: float
    issues: List[str]
    retry_recommended: bool
    detailed_scores: Dict[str, float] = {}
    reasoning_summary: str = ""