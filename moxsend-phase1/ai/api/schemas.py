"""
Pydantic v2 request/response schemas for the Moxsend Subject Line API.

Two endpoint contracts:

1. POST /generate
   Request:  BatchGenerateRequest  { leads: list[LeadInput] }
   Response: BatchGenerateResponse { results: list[LeadResult] }

2. POST /subject-lines
   Request:  SubjectLineRequest    { brief, industry, targetRole, country, tone }
   Response: SubjectLineResponse   { subjects, subjectLines }  <-- exact Node.js shape
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Shared models
# ---------------------------------------------------------------------------

class LeadInput(BaseModel):
    """
    A single B2B lead.  Mirrors Node.js JobRow — all fields optional so that
    partial data from the frontend/CSV doesn't break the pipeline.
    """
    email: str = Field(default="", description="Lead email address")
    firstname: str = Field(default="")
    lastname: str = Field(default="")
    phone: str = Field(default="")
    company: str = Field(default="")
    companyurl: str = Field(default="")
    city: str = Field(default="")
    country: str = Field(default="")
    designation: str = Field(default="", description="Job title / role")
    industry: str = Field(default="")
    company_size: str = Field(default="")
    lead_type: str = Field(default="")
    source: str = Field(default="")
    tags: str = Field(default="")
    notes: str = Field(default="")

    def to_dict(self) -> dict:
        return self.model_dump()


class SubjectLineEntry(BaseModel):
    """A single generated + scored subject line."""
    subject: str
    style: str = Field(description="Curious | Urgent | Friendly | Professional | Bold")
    score: float = Field(ge=0.0, le=10.0)
    reason: str


class LeadMeta(BaseModel):
    processing_time_ms: int
    model: str
    status: str  # "success" | "failed"
    error: Optional[str] = None


class LeadResult(BaseModel):
    """Full pipeline result for one lead."""
    email: str
    best_subject: SubjectLineEntry
    all_subjects: list[SubjectLineEntry]
    meta: LeadMeta


# ---------------------------------------------------------------------------
# POST /generate
# ---------------------------------------------------------------------------

class BatchGenerateRequest(BaseModel):
    """
    Batch subject line generation request.
    Accepts 1 to N leads — the pipeline processes them all.
    """
    leads: list[LeadInput] = Field(
        min_length=1,
        description="List of leads to generate subject lines for (1–N)",
    )


class BatchGenerateResponse(BaseModel):
    success: bool = True
    total: int
    results: list[LeadResult]


# ---------------------------------------------------------------------------
# POST /subject-lines   (drop-in for Node.js /api/ai/subject-lines)
# ---------------------------------------------------------------------------

class SubjectLineRequest(BaseModel):
    """
    Brief-mode request — matches the exact Node.js frontend contract.
    Also accepts a `leads` array for multi-lead brief-mode generation.
    """
    # Brief mode fields (single-lead)
    brief: str = Field(default="", description="What you're selling / campaign context")
    industry: str = Field(default="")
    targetRole: str = Field(default="", alias="targetRole")
    country: str = Field(default="")
    tone: str = Field(default="professional")

    # Optional: explicit lead data overrides the brief
    leads: Optional[list[LeadInput]] = Field(
        default=None,
        description="If provided, generate subjects for each lead instead of brief mode",
    )

    # Optional context ids (forwarded from frontend)
    campaignId: Optional[str] = None
    userId: Optional[str] = None
    organizationId: Optional[str] = None

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def at_least_brief_or_leads(self) -> "SubjectLineRequest":
        if not self.brief and not self.leads:
            raise ValueError("Provide either 'brief' or 'leads'.")
        return self


class SubjectLineVariant(BaseModel):
    """Matches Node.js subjectLines row shape."""
    style: str
    subject: str
    score: float  # 1–10 (not 0–1 like the canonical form)
    reason: str


class SubjectLineCanonical(BaseModel):
    """Matches Node.js subjects row shape (0–1 score)."""
    text: str
    score: float  # 0.0 – 1.0


class SubjectLineResponse(BaseModel):
    """
    Exact Node.js /api/ai/subject-lines response shape.
    The frontend already consumes this format.
    """
    success: bool = True
    # subjectLines: legacy rows with 1-10 score
    subjectLines: list[SubjectLineVariant]
    # subjects: canonical rows with 0-1 score
    subjects: list[SubjectLineCanonical]
    # When multiple leads were provided, also return per-lead detail
    results: Optional[list[LeadResult]] = None


# ---------------------------------------------------------------------------
# POST /prompt  (Node.js SUBJECT_AI_ENDPOINT pass-through)
# ---------------------------------------------------------------------------

class PromptRequest(BaseModel):
    """
    Raw prompt request — exactly what Node.js subjectLineHttp.provider.js sends.
    Body: { "prompt": "<full prompt string>" }
    """
    prompt: str = Field(description="The full prompt string assembled by the Node.js pipeline")


class PromptRawResponse(BaseModel):
    """
    Raw response consumed by Node.js parseSubjectResponseToNormalized.
    Must return { "subjectLines": [...] } so the parser can normalise it.
    """
    subjectLines: list[SubjectLineVariant]


# ---------------------------------------------------------------------------
# POST /personalize-email
# ---------------------------------------------------------------------------

class PersonalizeEmailRequest(BaseModel):
    """
    Exact body shape the Next.js /api/groq/personalize-email route sends.
    All field names match the TypeScript PersonalizeEmailPromptParams type.
    """
    offer: str
    length: str = Field(default="medium", description="short | medium | long")
    personalizeKeys: list[str] = Field(default_factory=list)
    extraInstructions: str = Field(default="")
    sampleRow: dict = Field(description="Lead row with at least email, firstname, company etc.")
    variantLabel: str = Field(default="A", description="A | B")
    cohortRows: Optional[list[dict]] = None
    # Optional context ids (ignored, passed through for compatibility)
    jobId: Optional[str] = None
    campaignId: Optional[str] = None
    userId: Optional[str] = None
    organizationId: Optional[str] = None

    model_config = {"populate_by_name": True}


class PersonalizeTelemetry(BaseModel):
    traceId: str
    requestId: str
    status: str
    processingTimeMs: int
    provider: str = "qwen"
    model: str = "qwen2.5:7b"
    retryCount: int = 0
    variantLabel: Optional[str] = None


class PersonalizeEmailResponse(BaseModel):
    ok: bool = True
    subject: str
    body: str
    personalization_score: int
    cultural_fit_score: int
    reply_likelihood_score: int
    language_mode: str
    reasoning_summary: str
    telemetry: PersonalizeTelemetry


# ---------------------------------------------------------------------------
# GET /ai-generation-logs  /  GET+POST /ai-personalize-saves
# ---------------------------------------------------------------------------

class AiGenerationLogItem(BaseModel):
    id: str
    created_at: str
    request_id: Optional[str] = None
    trace_id: Optional[str] = None
    job_id: Optional[str] = None
    event_type: str
    status: str
    provider: Optional[str] = None
    model: Optional[str] = None
    processing_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    retry_count: int = 0


class AiPersonalizeSaveItem(BaseModel):
    id: str
    created_at: str
    import_job_id: Optional[str] = None
    reference_lead_email: str
    reference_display: str
    selected_lead_count: int
    offer: str
    extra_instructions: str = ""
    email_length: str
    personalize_keys: list[str]
    ab_enabled: bool
    subject_a: str
    body_html_a: str
    subject_b: Optional[str] = None
    body_html_b: Optional[str] = None


class AiPersonalizeSaveRequest(BaseModel):
    importJobId: Optional[str] = None
    referenceLeadEmail: str
    referenceDisplay: str
    selectedLeadCount: int = 0
    offer: str
    extraInstructions: str = ""
    emailLength: str
    personalizeKeys: list[str]
    abEnabled: bool = False
    subjectA: str
    bodyHtmlA: str
    subjectB: Optional[str] = None
    bodyHtmlB: Optional[str] = None


