from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseProvider(ABC):
    @abstractmethod
    def invoke(self, prompt: str, **kwargs) -> Dict[str, Any]:
        pass