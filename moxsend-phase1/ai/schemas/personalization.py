from pydantic import BaseModel
from typing import List, Optional

class PersonalizationContext(BaseModel):
    industry: str
    persona: str
    pain_points: List[str]
    urgency_level: str  # 'low', 'medium', 'high'
    tone_strategy: str
    narrative_hint: str
    business_pressure: Optional[str] = None
    messaging_angle: Optional[str] = None