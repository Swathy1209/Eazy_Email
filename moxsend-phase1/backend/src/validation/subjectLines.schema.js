const { z } = require('zod');

const personalizationVariablesSchema = z
  .record(z.string().max(2000))
  .refine((o) => Object.keys(o).length <= 100, { message: 'Too many personalization keys.' });

const cohortRowSchema = z.record(z.unknown());

exports.subjectLinesRequestSchema = z
  .object({
    brief: z.string().trim().min(1, 'brief is required').max(8000),
    industry: z.string().trim().max(500).optional(),
    targetRole: z.string().trim().max(500).optional(),
    country: z.string().trim().max(500).optional(),
    tone: z.string().trim().max(64).optional(),
    campaignId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    organizationId: z.string().uuid().optional(),
    cohort: z.array(cohortRowSchema).max(500).optional(),
    personalizationVariables: personalizationVariablesSchema.optional(),
    rows: z.array(cohortRowSchema).max(1000).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.cohort !== undefined && val.cohort.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'cohort must not be an empty array.' });
    }
    if (val.rows !== undefined && val.rows.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rows must not be an empty array.' });
    }
  });
