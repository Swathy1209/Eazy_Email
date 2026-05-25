from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol

from dotenv import load_dotenv

# Load environment variables.
_AI_ROOT = Path(__file__).resolve().parents[1]
_REPO_ROOT = _AI_ROOT.parent

# Priority: ai/.env (internal) -> root/.env.local (main config)
load_dotenv(dotenv_path=_AI_ROOT / ".env", override=True)
load_dotenv(dotenv_path=_REPO_ROOT / ".env.local", override=True)

# Switch providers by changing this ONE variable (or setting LLM_PROVIDER env).
ACTIVE_PROVIDER = "groq"  # "groq" | "qwen"


class _Provider(Protocol):
    def generate(self, prompt: str, *, json_mode: bool = False) -> str: ...


class LLM:
    def __init__(self, provider: _Provider | None = None):
        self._default_provider = provider or _select_provider()

    def generate(self, prompt: str, provider_name: str | None = None) -> str:
        # Fallback sequence
        primary_name = provider_name or (os.getenv("LLM_PROVIDER", "") or ACTIVE_PROVIDER).strip().lower()
        fallbacks = [primary_name, "gemini", "qwen"]
        
        last_error = None
        tried = set()
        
        for name in fallbacks:
            if name in tried: continue
            tried.add(name)
            try:
                p = _get_provider(name)
                return p.generate(prompt, json_mode=False)
            except Exception as e:
                last_error = e
                if "rate_limit" in str(e).lower() or "429" in str(e):
                    continue # Try next fallback
                raise e # For other errors, we might want to fail fast or continue. Let's continue for now.
        
        raise last_error if last_error else Exception("No LLM providers available")

    def generate_json(self, prompt: str, provider_name: str | None = None) -> str:
        # Fallback sequence
        primary_name = provider_name or (os.getenv("LLM_PROVIDER", "") or ACTIVE_PROVIDER).strip().lower()
        fallbacks = [primary_name, "gemini", "qwen"]
        
        last_error = None
        tried = set()
        
        for name in fallbacks:
            if name in tried: continue
            tried.add(name)
            try:
                p = _get_provider(name)
                return p.generate(prompt, json_mode=True)
            except Exception as e:
                last_error = e
                continue
        
        raise last_error if last_error else Exception("No LLM providers available")


def _get_provider(name: str) -> _Provider:
    name = name.strip().lower()
    if name == "qwen":
        from llm_handler.qwen_handler import load_qwen_handler
        return load_qwen_handler()
    if name in ["gemini", "google"]:
        from llm_handler.gemini_handler import load_gemini_handler
        return load_gemini_handler()
    
    from llm_handler.groq_handler import load_groq_handler
    return load_groq_handler()


def _select_provider() -> _Provider:
    provider_name = (os.getenv("LLM_PROVIDER", "") or ACTIVE_PROVIDER).strip().lower()
    return _get_provider(provider_name)


llm = LLM()


