const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { ZodError } = require('zod');
const {
  generateSubjectLinesFromInput,
  DEFAULT_TONE,
  sanitizeInput,
} = require('../../../ai/subject-lines/subjectLineService');
const { subjectLinesRequestSchema } = require('../validation/subjectLines.schema');
const { validateMergeTagsInText } = require('../../../ai/validators/mergeTags');
const { persistAiGenerationLog } = require('../services/aiGenerationLog.service');
const { AI_EVENT_TYPES } = require('../../../ai/constants/aiEvents');

/**
 * @param {Record<string, unknown>} parsed
 */
function assertMergeTagsOnPayload(parsed) {
  /** @type {string[]} */
  const strings = [];
  for (const key of ['brief', 'industry', 'targetRole', 'country', 'tone']) {
    const v = parsed[key];
    if (typeof v === 'string' && v.length) strings.push(v);
  }
  if (parsed.personalizationVariables && typeof parsed.personalizationVariables === 'object') {
    for (const v of Object.values(parsed.personalizationVariables)) {
      if (typeof v === 'string') strings.push(v);
    }
  }
  for (const s of strings) {
    const check = validateMergeTagsInText(s);
    if (!check.ok) {
      throw new AppError(
        `Invalid merge tag in request: ${check.token}. Allowed tokens use: name, company, industry, region, city, role, website, designation.`,
        400,
        'INVALID_MERGE_TAG',
      );
    }
  }
}

const postSubjectLines = asyncHandler(async (req, res) => {
  let parsed;
  try {
    parsed = subjectLinesRequestSchema.parse(req.body ?? {});
  } catch (e) {
    if (e instanceof ZodError) {
      const message = e.errors.map((x) => x.message).join('; ');
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
    throw e;
  }

  assertMergeTagsOnPayload(parsed);

  const input = {
    brief: sanitizeInput(parsed.brief),
    industry: sanitizeInput(parsed.industry),
    targetRole: sanitizeInput(parsed.targetRole),
    country: sanitizeInput(parsed.country),
    tone: sanitizeInput(parsed.tone || DEFAULT_TONE).toLowerCase() || DEFAULT_TONE,
  };

  await persistAiGenerationLog({
    request_id: req.requestId,
    trace_id: req.traceId,
    campaign_id: parsed.campaignId ?? null,
    user_id: parsed.userId ?? null,
    organization_id: parsed.organizationId ?? null,
    event_type: AI_EVENT_TYPES.REQUEST_RECEIVED,
    status: 'ok',
    input_payload: {
      briefLen: input.brief.length,
      hasCohort: Boolean(parsed.cohort?.length),
      rowCount: parsed.rows?.length ?? 0,
    },
    validated_payload: {
      tone: input.tone,
      industry: input.industry,
      targetRole: input.targetRole,
      country: input.country,
    },
    environment: process.env.AI_LOG_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
  });

  const out = await generateSubjectLinesFromInput(input, {
    traceId: req.traceId,
    requestId: req.requestId,
    userId: parsed.userId,
    organizationId: parsed.organizationId,
    campaignId: parsed.campaignId,
  }, {
    persistLog: persistAiGenerationLog,
  });

  res.status(200).json({
    success: true,
    traceId: req.traceId,
    requestId: req.requestId,
    subjects: out.subjects,
    subjectLines: out.subjectLines,
  });
});

/**
 * @deprecated Prefer HTTP validation via subjectLinesRequestSchema.
 * @param {unknown} body
 */
function parseSubjectLineBody(body) {
  let parsed;
  try {
    parsed = subjectLinesRequestSchema.parse(body ?? {});
  } catch (e) {
    if (e instanceof ZodError) {
      const message = e.errors.map((x) => x.message).join('; ');
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
    throw e;
  }
  assertMergeTagsOnPayload(parsed);
  return {
    brief: sanitizeInput(parsed.brief),
    industry: sanitizeInput(parsed.industry),
    targetRole: sanitizeInput(parsed.targetRole),
    country: sanitizeInput(parsed.country),
    tone: sanitizeInput(parsed.tone || DEFAULT_TONE).toLowerCase() || DEFAULT_TONE,
  };
}

const { invokeLangGraphWorkflow } = require('../utils/pythonBridge');

const postCohortEmail = asyncHandler(async (req, res) => {
  const { leads, aiConfig } = req.body;
  if (!leads || !Array.isArray(leads)) {
    throw new AppError('Leads array is required', 400, 'VALIDATION_ERROR');
  }
  if (!aiConfig) {
    throw new AppError('aiConfig is required', 400, 'VALIDATION_ERROR');
  }

  const payload = {
    selected_leads: leads,
    campaign_brief: aiConfig.offer || '',
    tone: aiConfig.extraInstructions ? `Professional. Notes: ${aiConfig.extraInstructions}` : 'Professional',
    market: 'Global' // default or can be derived
  };

  try {
    const result = await invokeLangGraphWorkflow(payload);
    const subject = result.generated_subject_lines?.[0]?.subject;
    const bodyHtml = result.generated_base_email;
    if (!subject || !bodyHtml) {
      const extra = String(result?._stderr ?? '').trim();
      throw new Error(`LangGraph returned empty output${extra ? `; stderr: ${extra}` : ''}`);
    }
    res.status(200).json({
      success: true,
      email: { subject, bodyHtml },
      emails: leads.map(l => ({
        leadId: l.leadId || l.id,
        email: JSON.stringify({ 
          subject, 
          bodyHtml,
          personalization_reasoning: 'Base cohort generation',
          humanization_analysis: 'High-fidelity draft'
        })
      })),
      variants: result.generated_subject_lines || []
    });
  } catch (error) {
    const msg = String(error?.message ?? 'Unknown AI error');
    const lower = msg.toLowerCase();
    if (lower.includes('429') || lower.includes('rate limit')) {
      throw new AppError(`Cohort email generation failed: ${msg}`, 429, 'AI_RATE_LIMIT');
    }
    throw new AppError(`Cohort email generation failed: ${msg}`, 500, 'AI_ERROR');
  }
});

const postRefineEmail = asyncHandler(async (req, res) => {
  const { lead, baseEmail, baseSubject, refinementPrompt, tone } = req.body ?? {};
  if (!lead || typeof lead !== 'object') {
    throw new AppError('lead is required', 400, 'VALIDATION_ERROR');
  }
  const base_email = String(baseEmail ?? '').trim();
  const base_subject = String(baseSubject ?? '').trim();
  const refinement_prompt = String(refinementPrompt ?? '').trim();
  if (!base_email) throw new AppError('baseEmail is required', 400, 'VALIDATION_ERROR');
  if (!refinement_prompt) throw new AppError('refinementPrompt is required', 400, 'VALIDATION_ERROR');

  const payload = {
    action: 'refine_lead',
    tone: String(tone ?? 'Professional'),
    base_email,
    base_subject,
    refinement_prompt,
    active_lead: lead,
    selected_leads: [],
    campaign_brief: '',
    market: 'Global',
  };

  try {
    const result = await invokeLangGraphWorkflow(payload);
    const refined = result.refined_email;
    const subject = refined?.subject;
    const bodyHtml = refined?.bodyHtml;
    if (!subject || !bodyHtml) {
      const extra = String(result?._stderr ?? '').trim();
      throw new Error(`LangGraph returned empty refined output${extra ? `; stderr: ${extra}` : ''}`);
    }
    res.status(200).json({ 
      success: true, 
      email: { 
        subject, 
        bodyHtml,
        personalization_reasoning: refined?.personalization_reasoning || '',
        humanization_analysis: refined?.humanization_analysis || ''
      } 
    });
  } catch (error) {
    const msg = String(error?.message ?? 'Unknown AI error');
    const lower = msg.toLowerCase();
    if (lower.includes('429') || lower.includes('rate limit')) {
      throw new AppError(`Refinement failed: ${msg}`, 429, 'AI_RATE_LIMIT');
    }
    throw new AppError(`Refinement failed: ${msg}`, 500, 'AI_ERROR');
  }
});

const postSubjectOptimizer = asyncHandler(async (req, res) => {
  const subjectInput = String(req.body?.subject_input ?? req.body?.subjectInput ?? '').trim();
  if (!subjectInput) {
    throw new AppError('subject_input is required', 400, 'VALIDATION_ERROR');
  }

  const payload = {
    workflow: 'subject_optimizer',
    subject_input: subjectInput,
    campaign_context: String(req.body?.campaign_context ?? req.body?.campaignContext ?? '').trim(),
    lead_context: String(req.body?.lead_context ?? req.body?.leadContext ?? '').trim(),
    offer_context: String(req.body?.offer_context ?? req.body?.offerContext ?? '').trim(),
    tone: String(req.body?.tone ?? 'Professional').trim() || 'Professional',
  };

  try {
    const result = await invokeLangGraphWorkflow(payload);
    const variants = Array.isArray(result.variants) ? result.variants : [];

    if (!variants.length) {
      const extra = String(result?._stderr ?? '').trim();
      throw new Error(`LangGraph returned empty subject variants${extra ? `; stderr: ${extra}` : ''}`);
    }

    res.status(200).json({
      success: Boolean(result.success),
      variants,
    });
  } catch (error) {
    const msg = String(error?.message ?? 'Unknown AI error');
    const lower = msg.toLowerCase();
    if (lower.includes('429') || lower.includes('rate limit')) {
      throw new AppError(`Subject optimization failed: ${msg}`, 429, 'AI_RATE_LIMIT');
    }
    throw new AppError(`Subject optimization failed: ${msg}`, 500, 'AI_ERROR');
  }
});

const postBenchmarkRun = asyncHandler(async (req, res) => {
  const { leads, models, aiConfig, language } = req.body;
  if (!leads || !Array.isArray(leads)) {
    throw new AppError('Leads array is required', 400, 'VALIDATION_ERROR');
  }
  if (!models || !Array.isArray(models)) {
    throw new AppError('Models array is required', 400, 'VALIDATION_ERROR');
  }

  const results = [];
  for (const model of models) {
    const startTime = Date.now();
    console.log(`[DEBUG] Processing model: ${model}`);
    try {
      const payload = {
        workflow: 'benchmark',
        selected_leads: [leads[0]],
        active_lead: leads[0],
        campaign_brief: aiConfig.offer || '',
        tone: aiConfig.extraInstructions ? `Professional. Notes: ${aiConfig.extraInstructions}` : 'Professional',
        market: 'Global',
        language: language || 'english',
        model: model // pass selected model
      };

      const result = await invokeLangGraphWorkflow(payload);
      console.log(`[DEBUG] Workflow result for ${model}:`, JSON.stringify(result).slice(0, 500));
      
      const latency = Date.now() - startTime;

      // Real Provider Cost Tiers
      let costTier = 'Low';
      const mLower = String(model).toLowerCase();
      if (mLower.includes('gpt-4') || mLower.includes('pro') || mLower.includes('3.5-sonnet')) {
        costTier = 'High';
      } else if (mLower.includes('flash') || mLower.includes('8b') || mLower.includes('small')) {
        costTier = 'Medium';
      } else if (mLower.includes('groq')) {
        costTier = 'Low';
      } else if (mLower.includes('qwen') || mLower.includes('local')) {
        costTier = 'Free';
      }

      const metrics = result.metrics || {};

      results.push({
        model: model,
        quality_score: Number(metrics.quality_score || 0),
        personalization_score: Number(metrics.personalization_score || 0),
        humanization_score: Number(metrics.humanization_score || 0),
        regional_fit_score: Number(metrics.regional_fit_score || 0),
        latency_ms: Number(metrics.latency_ms || latency),
        retry_count: Number(result.retry_count || 0),
        estimated_cost: costTier,
        hallucination_detected: Boolean(metrics.hallucination_detected || false),
        workflow_stage: String(metrics.workflow_stage || 'completed'),
        subject: String(result.generated_subject_lines?.[0]?.subject || result.subject || 'No Subject'),
        body: String(result.generated_base_email || result.body || 'No Content'),
        strengths: Array.isArray(metrics.strengths) ? metrics.strengths : [],
        weaknesses: Array.isArray(metrics.weaknesses) ? metrics.weaknesses : [],
        humanization_summary: String(metrics.humanization_summary || ''),
        regional_summary: String(metrics.regional_summary || ''),
        evaluator_summary: String(metrics.summary || 'Standard generation completed successfully.')
      });
    } catch (error) {
      console.error(`[ERROR] Benchmark loop failed for ${model}:`, error);
      results.push({
        model: model,
        error: String(error.message || 'Unknown error during benchmark'),
        success: false,
        quality_score: 0,
        latency_ms: 0,
        workflow_stage: 'failed'
      });
    }
  }

  res.status(200).json({
    success: true,
    results
  });
});

module.exports = {
  postSubjectLines,
  parseSubjectLineBody,
  postCohortEmail,
  postRefineEmail,
  postSubjectOptimizer,
  postBenchmarkRun,
};

