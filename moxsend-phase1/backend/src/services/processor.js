const { getJob, updateJob } = require('../store/jobStore');
const { FAST_INITIAL_ROWS } = require('./csvConstants');
const { generateFullEmailBundle } = require('./aiGeneration.service');

/** @typedef {import('./jobTypes').JobRow} JobRow */

const MIN_ROW_DELAY_MS = 50;
const MAX_ROW_DELAY_MS = 150;
const BATCH_SIZE = Math.max(1, Number(process.env.CSV_PROCESS_BATCH_SIZE ?? 5));
const BATCH_DELAY_MS = Math.max(0, Number(process.env.CSV_BATCH_DELAY_MS ?? 300));

const MANDATORY_ROW_FIELDS = [
  'email',
  'firstname',
  'lastname',
  'phone',
  'company',
  'city',
  'country',
  'industry',
];

/**
 * @param {number} min
 * @param {number} max
 */
function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @param {JobRow} row
 */
function rowKey(row) {
  return String(row.email ?? '')
    .trim()
    .toLowerCase();
}

/**
 * @param {JobRow} row
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateInputRow(row) {
  if (!row || typeof row !== 'object') {
    return { ok: false, reason: 'Invalid row payload.' };
  }

  const allEmpty = MANDATORY_ROW_FIELDS.every((f) => String(row[f] ?? '').trim() === '');
  if (allEmpty) {
    return { ok: false, reason: 'Empty row.' };
  }

  const missing = MANDATORY_ROW_FIELDS.filter((f) => String(row[f] ?? '').trim() === '');
  if (missing.length) {
    return { ok: false, reason: `Missing required field(s): ${missing.join(', ')}.` };
  }

  const email = String(row.email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'Invalid email address.' };
  }

  return { ok: true };
}

/**
 * @param {JobRow} row
 * @returns {Promise<import('./jobTypes').ProcessedRowOutput>}
 */
async function buildPipelineOutput(row) {
  const emailOutput = await generateEmail(row);
  const subjects = await generateSubjectLines(row, emailOutput.body);
  
  return {
    ...emailOutput,
    variants: subjects
  };
}

/**
 * @param {JobRow} row
 * @param {'success' | 'failed'} status
 * @param {import('./jobTypes').ProcessedRowOutput | null} output
 * @param {string} [error]
 */
function buildResultRow(row, status, output, error) {
  const firstname = String(row?.firstname ?? '').trim();
  const lastname = String(row?.lastname ?? '').trim();
  return {
    email: String(row?.email ?? '').trim(),
    firstname,
    lastname,
    phone: String(row?.phone ?? '').trim(),
    company: String(row?.company ?? '').trim(),
    companyurl: String(row?.companyurl ?? '').trim(),
    city: String(row?.city ?? '').trim(),
    country: String(row?.country ?? '').trim(),
    designation: String(row?.designation ?? '').trim(),
    industry: String(row?.industry ?? '').trim(),
    company_size: String(row?.company_size ?? '').trim(),
    lead_type: String(row?.lead_type ?? '').trim(),
    source: String(row?.source ?? '').trim(),
    tags: String(row?.tags ?? '').trim(),
    notes: String(row?.notes ?? '').trim(),
    name: [firstname, lastname].filter(Boolean).join(' ').trim(),
    status,
    output,
    ...(error ? { error } : {}),
  };
}

/**
 * Rebuild a CSV-shaped row from a stored result (for targeted retries).
 * @param {import('./jobTypes').ProcessedRowResult} r
 * @returns {JobRow}
 */
function resultToJobRow(r) {
  return {
    email: r.email,
    firstname: r.firstname,
    lastname: r.lastname,
    phone: r.phone,
    company: r.company,
    companyurl: r.companyurl,
    city: r.city,
    country: r.country,
    designation: r.designation,
    industry: r.industry,
    company_size: r.company_size,
    lead_type: r.lead_type,
    source: r.source ?? '',
    tags: r.tags ?? '',
    notes: r.notes ?? '',
  };
}

/**
 * Dedupe keys from rows that already succeeded (retry must respect them).
 * @param {import('./jobTypes').ProcessedRowResult[]} data
 */
function collectSuccessKeys(data) {
  const seen = new Set();
  for (const row of data) {
    if (row.status !== 'success') continue;
    seen.add(rowKey(resultToJobRow(row)));
  }
  return seen;
}

/**
 * Processes a single logical row: validation, duplicate detection, AI generation.
 * @param {JobRow} row
 * @param {Set<string>} seenKeys
 */
async function evaluateRow(row, seenKeys) {
  const validation = validateInputRow(row);
  if (!validation.ok) {
    return buildResultRow(row, 'failed', null, validation.reason);
  }

  const key = rowKey(row);
  if (!key) {
    return buildResultRow(row, 'failed', null, 'Missing email for deduplication.');
  }
  if (seenKeys.has(key)) {
    return buildResultRow(row, 'failed', null, 'Duplicate row (same email).');
  }
  seenKeys.add(key);

  try {
    const output = await buildPipelineOutput(row);
    return buildResultRow(row, 'success', output);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected generation error.';
    return buildResultRow(row, 'failed', null, message);
  }
}

/**
 * Applies one processed result to the in-memory job (atomic mutation per row).
 * @param {string} jobId
 * @param {import('./jobTypes').ProcessedRowResult} result
 */
function appendJobProgress(jobId, result) {
  updateJob(jobId, (job) => {
    job.processedRows += 1;
    if (result.status === 'success') {
      job.successCount += 1;
    } else {
      job.failureCount += 1;
    }
    job.data.push(result);
  });
}

/**
 * Marks terminal job state when the worker cannot continue safely.
 * @param {string} jobId
 * @param {'completed' | 'failed'} status
 */
function setJobTerminalStatus(jobId, status) {
  updateJob(jobId, (job) => {
    job.status = status;
  });
}

/**
 * Per-row delay: first FAST_INITIAL_ROWS complete quickly so the UI can populate.
 * @param {number} rowIndex zero-based
 */
function rowDelayMs(rowIndex) {
  if (rowIndex < FAST_INITIAL_ROWS) {
    return 0;
  }
  return randomIntInclusive(MIN_ROW_DELAY_MS, MAX_ROW_DELAY_MS);
}

const { invokeLangGraphWorkflow } = require('../utils/pythonBridge');

/**
 * Core background worker: processes all rows in batch via LangGraph.
 *
 * @param {string} jobId
 * @param {JobRow[]} rows
 */
async function processJobAsync(jobId, rows) {
  const job = getJob(jobId);
  if (!job) {
    console.warn(`[processor] Job not found, skipping: ${jobId}`);
    return;
  }

  const validRows = [];
  const invalidResults = [];
  const seenKeys = new Set();

  // 1. Validate all rows first
  for (const row of rows) {
    const validation = validateInputRow(row);
    if (!validation.ok) {
      invalidResults.push(buildResultRow(row, 'failed', null, validation.reason));
      continue;
    }
    const key = rowKey(row);
    if (!key) {
      invalidResults.push(buildResultRow(row, 'failed', null, 'Missing email for deduplication.'));
      continue;
    }
    if (seenKeys.has(key)) {
      invalidResults.push(buildResultRow(row, 'failed', null, 'Duplicate row (same email).'));
      continue;
    }
    seenKeys.add(key);
    validRows.push(row);
  }

  try {
    updateJob(jobId, (j) => { j.status = 'processing'; });

    let commonOutput = null;

    if (validRows.length > 0) {
      // Create LangGraph payload using a sample to avoid context limits
      const sampleLeads = validRows.slice(0, 10);
      const payload = {
        selected_leads: sampleLeads,
        campaign_brief: validRows[0]?.notes || 'General business outreach',
        tone: 'Professional',
        market: 'Global'
      };

      const aiResult = await invokeLangGraphWorkflow(payload);

      const baseEmailBody = aiResult?.generated_base_email || "Hi {{name}},\n\nWe noticed your great work at {{company}}.\n\nBest,\nMoxsend Team";
      const subjects = aiResult?.generated_subject_lines || [];

      commonOutput = {
        subject: subjects[0]?.subject || "Partnership Opportunity",
        body: baseEmailBody,
        personalization_score: 90,
        cultural_fit_score: 85,
        reply_likelihood_score: 88,
        language_mode: "en",
        reasoning_summary: "Generated ONE common base email for all selected leads via LangGraph.",
        variants: subjects
      };
    }

    // 2. Append invalid results
    for (const res of invalidResults) {
      appendJobProgress(jobId, res);
    }

    // 3. Append valid results
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      // small delay to allow UI to show progress bar updates if needed
      if (rowDelayMs(i) > 0) {
        await delay(rowDelayMs(i));
      }
      const res = buildResultRow(row, 'success', commonOutput);
      appendJobProgress(jobId, res);
    }

    setJobTerminalStatus(jobId, 'completed');
  } catch (err) {
    console.error(`[processor] Unexpected failure for job ${jobId}:`, err);
    
    // Fail all valid rows if LangGraph failed
    for (const row of validRows) {
      appendJobProgress(jobId, buildResultRow(row, 'failed', null, err.message));
    }
    
    const stillThere = getJob(jobId);
    if (stillThere) {
      setJobTerminalStatus(jobId, 'failed');
    }
  }
}

/**
 * Schedules background processing without blocking the caller.
 *
 * @param {string} jobId
 * @param {JobRow[]} rows
 */
function scheduleJobProcessing(jobId, rows) {
  setImmediate(() => {
    void processJobAsync(jobId, rows);
  });
}

/**
 * Re-runs **only** failed rows in-place: adjusts success/failure counts and preserves order.
 * Sets job to `processing` while work runs, then `completed` (or `failed` on unexpected error).
 *
 * @param {string} jobId
 */
async function retryFailedRowsAsync(jobId) {
  const job = getJob(jobId);
  if (!job) {
    // eslint-disable-next-line no-console
    console.warn(`[processor] Retry: job not found ${jobId}`);
    return;
  }

  const failedIndices = job.data
    .map((r, i) => (r.status === 'failed' ? i : -1))
    .filter((i) => i >= 0);

  if (!failedIndices.length) {
    return;
  }

  try {
    updateJob(jobId, (j) => {
      j.status = 'processing';
    });

    const seenKeys = collectSuccessKeys(job.data);

    for (let fi = 0; fi < failedIndices.length; fi += 1) {
      const i = failedIndices[fi];
      const current = getJob(jobId);
      if (!current) {
        // eslint-disable-next-line no-console
        console.warn(`[processor] Retry: job removed mid-flight ${jobId}`);
        return;
      }

      // eslint-disable-next-line no-await-in-loop
      await delay(rowDelayMs(fi));

      const prev = current.data[i];
      if (!prev || prev.status !== 'failed') {
        continue;
      }

      const row = resultToJobRow(prev);
      const result = await evaluateRow(row, seenKeys);

      updateJob(jobId, (j) => {
        const wasFailed = j.data[i].status === 'failed';
        j.data[i] = result;
        if (wasFailed && result.status === 'success') {
          j.successCount += 1;
          j.failureCount -= 1;
        }
      });
    }

    setJobTerminalStatus(jobId, 'completed');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[processor] Retry failed for job ${jobId}:`, err);
    const stillThere = getJob(jobId);
    if (stillThere) {
      setJobTerminalStatus(jobId, 'failed');
    }
  }
}

function scheduleRetryFailedRows(jobId) {
  setImmediate(() => {
    void retryFailedRowsAsync(jobId);
  });
}

module.exports = {
  scheduleJobProcessing,
  processJobAsync,
  scheduleRetryFailedRows,
};
