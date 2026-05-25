from pydantic import BaseModel
from typing import Optional

class NarrativeContext(BaseModel):
    primary_narrative: str
    secondary_narrative: Optional[str] = None
    emotional_strategy: str
    business_focus: str