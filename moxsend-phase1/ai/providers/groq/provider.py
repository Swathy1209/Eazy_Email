from typing import Dict, Any
from langchain_groq import ChatGroq
from ..base_provider import BaseProvider

class GroqProvider(BaseProvider):
    def __init__(self, config: Dict[str, Any]):
        self.model = config.get('model', 'llama3-8b-8192')
        self.api_key = config.get('api_key')
        self.llm = ChatGroq(model=self.model, api_key=self.api_key)

    def invoke(self, prompt: str, **kwargs) -> Dict[str, Any]:
        response = self.llm.invoke(prompt)
        return {'content': response.content, 'metadata': {}}