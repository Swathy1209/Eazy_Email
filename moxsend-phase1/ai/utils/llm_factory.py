"""
Backward-compatible wrapper for legacy code that expects `get_llm().invoke(...)`.

All provider selection and model initialization is centralized in `ai/llm_handler`.
New code should import:

  from llm_handler.llm_handler import llm
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Tuple

from llm_handler.llm_handler import llm as _router


@dataclass
class _CompatResponse:
    content: str


class _CompatLLM:
    def __init__(self, *, json_mode: bool):
        self._json_mode = json_mode

    def invoke(self, messages: Iterable[Tuple[str, str]]):
        # Messages are provided as [("system", "..."), ("human", "...")]. We preserve ordering.
        prompt = "\n\n".join(str(m[1]) for m in messages)
        if self._json_mode:
            out = _router.generate_json(prompt)
        else:
            out = _router.generate(prompt)
        return _CompatResponse(content=out)


def get_llm(*, json_mode: bool = False, **_kwargs: Any):
    return _CompatLLM(json_mode=json_mode)
