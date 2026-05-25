from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from ..base_provider import BaseProvider

class GeminiProvider(BaseProvider):
    def __init__(self, config: Dict[str, Any]):
        self.model = config.get('model', 'gemini-1.5-flash')
        self.api_key = config.get('api_key')
        self.llm = ChatGoogleGenerativeAI(
            model=self.model, 
            google_api_key=self.api_key,
            temperature=config.get('temperature', 0.7)
        )

    def invoke(self, prompt: str, **kwargs) -> Dict[str, Any]:
        response = self.llm.invoke(prompt)
        return {'content': response.content, 'metadata': {}}
