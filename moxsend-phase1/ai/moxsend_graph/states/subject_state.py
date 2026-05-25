"""
State definitions for the legacy subject-line LangGraph pipeline.

These types are kept small and self-contained so the Python bridge can import
the subject workflow without depending on package-relative import tricks.
"""

from __future__ import annotations

from typing import Any, Optional
from typing_extensions import TypedDict


class LeadInput(TypedDict, total=False):
    email: str
    firstname: str
    lastname: str
    phone: str
    company: str
    companyurl: str
    city: str
    country: str
    designation: str
    industry: str
    company_size: str
    lead_type: str
    source: str
    tags: str
    notes: str


class SubjectLineEntry(TypedDict):
    subject: str
    style: str
    score: float
    reason: str


class LeadMeta(TypedDict):
    processing_time_ms: int
    model: str
    status: str
    error: Optional[str]


class LeadResult(TypedDict):
    email: str
    best_subject: SubjectLineEntry
    all_subjects: list[SubjectLineEntry]
    meta: LeadMeta


class SubjectGraphState(TypedDict, total=False):
    lead: LeadInput
    raw_subjects: list[dict[str, Any]]
    scored_subjects: list[SubjectLineEntry]
    best_subject: SubjectLineEntry
    error: Optional[str]
