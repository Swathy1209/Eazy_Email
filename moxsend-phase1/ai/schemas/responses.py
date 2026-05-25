from pydantic import BaseModel
from typing import Dict, Any

class ModelResponse(BaseModel):
    content: str
    metadata: Dict[str, Any]