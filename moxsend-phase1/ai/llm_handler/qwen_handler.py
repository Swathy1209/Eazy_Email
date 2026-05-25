from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class QwenConfig:
    model: str = "qwen2.5:7b"
    temperature: float = 0.7
    max_tokens: int = 1024


class QwenHandler:
    def __init__(self, cfg: QwenConfig):
        self.cfg = cfg

    def _client(self, *, json_mode: bool):
        # Lazy import so Groq-only installs don't require langchain_ollama.
        from langchain_ollama import ChatOllama

        kwargs = {
            "model": self.cfg.model,
            "temperature": self.cfg.temperature,
        }
        # ChatOllama supports `format="json"` for structured output in many setups.
        if json_mode:
            kwargs["format"] = "json"
        # Some versions support num_predict to cap output tokens.
        kwargs["num_predict"] = self.cfg.max_tokens
        return ChatOllama(**kwargs)

    def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        llm = self._client(json_mode=json_mode)
        resp = llm.invoke([("human", prompt)])
        return str(getattr(resp, "content", "") or "")


def load_qwen_handler() -> QwenHandler:
    model = os.getenv("QWEN_MODEL", "").strip() or "qwen2.5:7b"
    temperature = float(os.getenv("QWEN_TEMPERATURE", os.getenv("GROQ_TEMPERATURE", "0.7")) or "0.7")
    max_tokens = int(os.getenv("QWEN_MAX_TOKENS", os.getenv("GROQ_MAX_TOKENS", "1024")) or "1024")
    return QwenHandler(QwenConfig(model=model, temperature=temperature, max_tokens=max_tokens))

