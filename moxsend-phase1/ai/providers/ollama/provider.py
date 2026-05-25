from typing import Dict, Any
from langchain_ollama import ChatOllama
from ..base_provider import BaseProvider

class OllamaProvider(BaseProvider):
    def __init__(self, config: Dict[str, Any]):
        self.model = config.get('model', 'qwen2.5:7b')
        self.llm = ChatOllama(model=self.model)

    def invoke(self, prompt: str, **kwargs) -> Dict[str, Any]:
        response = self.llm.invoke(prompt)
        return {'content': response.content, 'metadata': {}}