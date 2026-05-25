from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI

@dataclass
class GeminiConfig:
    model: str
    api_key: str
    temperature: float = 0.7
    max_tokens: int = 2048

class GeminiHandler:
    def __init__(self, cfg: GeminiConfig):
        self.cfg = cfg

    def _client(self) -> ChatGoogleGenerativeAI:
        return ChatGoogleGenerativeAI(
            model=self.cfg.model,
            google_api_key=self.cfg.api_key,
            temperature=self.cfg.temperature,
            max_output_tokens=self.cfg.max_tokens,
        )

    def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        llm = self._client()
        resp = llm.invoke([("human", prompt)])
        return str(getattr(resp, "content", "") or "")

def load_gemini_handler() -> GeminiHandler:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "").strip() or "gemini-1.5-flash"
    temperature = float(os.getenv("GEMINI_TEMPERATURE", "0.7") or "0.7")
    max_tokens = int(os.getenv("GEMINI_MAX_TOKENS", "2048") or "2048")

    cfg = GeminiConfig(
        model=model,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return GeminiHandler(cfg)
