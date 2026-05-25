from typing import Dict, Any
from .base_provider import BaseProvider
from .ollama.provider import OllamaProvider
from .groq.provider import GroqProvider
from .gemini.provider import GeminiProvider

class ModelRouter:
    def __init__(self, config: Dict[str, Any]):
        self.providers = {
            'ollama': OllamaProvider(config.get('ollama', {})),
            'groq': GroqProvider(config.get('groq', {})),
            'google': GeminiProvider(config.get('google', {})),
            # Add others as implemented
        }
        self.routing = config.get('routing', {})

    def invoke_model(self, task_type: str, prompt: str, **kwargs) -> Dict[str, Any]:
        provider_name = self.routing.get(task_type, 'ollama')
        provider = self.providers.get(provider_name)
        if not provider:
            raise ValueError(f"Provider {provider_name} not configured")
        return provider.invoke(prompt, **kwargs)