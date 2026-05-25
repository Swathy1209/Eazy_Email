const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError } = require('../src/utils/AppError');
const { parseSubjectLineBody } = require('../src/controllers/ai.controller');
const {
  normalizeSubjectLines,
  ensureExactlyFive,
  buildFallbackSubjectLines,
  generateSubjectLinesFromInput,
  clearSubjectLineCache,
} = require('../../ai/subject-lines/subjectLineService');

test('validation failure: missing brief throws AppError', () => {
  assert.throws(() => parseSubjectLineBody({ tone: 'professional' }), (err) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.statusCode, 400);
    assert.equal(err.code, 'VALIDATION_ERROR');
    return true;
  });
});

test('normalization removes invalid entries and deduplicates', () => {
  const out = normalizeSubjectLines([
    { style: 'Benefit', subject: 'Improve conversions', score: 22, reason: '' },
    { style: 'Benefit', subject: 'Improve conversions', score: 3, reason: 'duplicate' },
    { style: '', subject: '  ', score: 2, reason: 'empty subject' },
    { subject: 'Shorter sales cycle', score: 0 },
  ]);

  assert.equal(out.length, 2);
  assert.equal(out[0].score, 10);
  assert.equal(out[1].style, 'General');
  assert.equal(out[1].score, 1);
});

test('fallback behavior ensures exactly five on provider failure', async () => {
  clearSubjectLineCache();
  const prev = process.env.SUBJECT_AI_ENDPOINT;
  process.env.SUBJECT_AI_ENDPOINT = 'http://127.0.0.1:1/fail-fast';

  const result = await generateSubjectLinesFromInput({
    brief: 'Subject lines for CFO outreach in manufacturing',
    industry: 'Manufacturing',
    targetRole: 'CFO',
    country: 'Saudi Arabia',
    tone: 'professional',
  });

  if (prev === undefined) delete process.env.SUBJECT_AI_ENDPOINT;
  else process.env.SUBJECT_AI_ENDPOINT = prev;

  assert.equal(result.subjectLines.length, 5);
  const exact = ensureExactlyFive(
    result.subjectLines.slice(0, 2),
    buildFallbackSubjectLines('x', 'professional'),
  );
  assert.equal(exact.length, 5);
});
