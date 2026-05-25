from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Optional

from langchain_groq import ChatGroq


@dataclass
class GroqConfig:
    model: str
    api_key: str
    temperature: float = 0.7
    max_tokens: int = 1024
    request_timeout_s: float = 30.0
    max_retries: int = 2
    api_base: Optional[str] = None
    proxy: Optional[str] = None


class GroqHandler:
    def __init__(self, cfg: GroqConfig):
        self.cfg = cfg

    def _client(self, *, json_mode: bool) -> ChatGroq:
        kwargs: dict[str, Any] = {
            "model_name": self.cfg.model,
            "temperature": self.cfg.temperature,
            "max_tokens": self.cfg.max_tokens,
            "groq_api_key": self.cfg.api_key,
            "request_timeout": self.cfg.request_timeout_s,
            "max_retries": self.cfg.max_retries,
        }
        if self.cfg.api_base:
            kwargs["groq_api_base"] = self.cfg.api_base
        if self.cfg.proxy:
            kwargs["groq_proxy"] = self.cfg.proxy
        if json_mode:
            kwargs["model_kwargs"] = {"response_format": {"type": "json_object"}}
        return ChatGroq(**kwargs)

    def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        llm = self._client(json_mode=json_mode)
        resp = llm.invoke([("human", prompt)])
        return str(getattr(resp, "content", "") or "")


def load_groq_handler() -> GroqHandler:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv("GROQ_MODEL", "").strip() or "llama-3.3-70b-versatile"
    temperature = float(os.getenv("GROQ_TEMPERATURE", "0.7") or "0.7")
    max_tokens = int(os.getenv("GROQ_MAX_TOKENS", "1024") or "1024")
    request_timeout_s = float(os.getenv("GROQ_REQUEST_TIMEOUT_S", os.getenv("AI_REQUEST_TIMEOUT_S", "30")) or "30")
    max_retries = int(os.getenv("GROQ_MAX_RETRIES", "2") or "2")
    api_base = os.getenv("GROQ_API_BASE", "").strip() or os.getenv("GROQ_API_URL", "").strip() or None
    proxy = (
        os.getenv("GROQ_PROXY", "").strip()
        or os.getenv("HTTPS_PROXY", "").strip()
        or os.getenv("HTTP_PROXY", "").strip()
        or None
    )

    cfg = GroqConfig(
        model=model,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
        request_timeout_s=request_timeout_s,
        max_retries=max_retries,
        api_base=api_base,
        proxy=proxy,
    )
    return GroqHandler(cfg)

