const { asyncHandler } = require('../utils/asyncHandler');
const { listStoredLeadsForUi } = require('../services/supabase.service');
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');

const SCOPE = 'http';

/** GET /api/stored-leads — rows from Supabase `leads`. */
const getStoredLeads = asyncHandler(async (req, res) => {
  const raw = req.query?.limit;
  const limit = Math.min(500, Math.max(1, parseInt(String(raw ?? '100'), 10) || 100));

  try {
    const result = await listStoredLeadsForUi(limit);
    logger.info(SCOPE, 'GET /api/stored-leads', { configured: result.configured, count: result.leads.length });
    res.json({
      configured: result.configured,
      count: result.leads.length,
      leads: result.leads,
      ...(result.hint ? { hint: result.hint } : {}),
    });
  } catch (err) {
    logger.error(SCOPE, 'GET /api/stored-leads failed', err);
    throw new AppError(
      err instanceof Error ? err.message : 'Failed to load stored leads.',
      502,
      'SUPABASE_ERROR',
    );
  }
});

module.exports = {
  getStoredLeads,
};
