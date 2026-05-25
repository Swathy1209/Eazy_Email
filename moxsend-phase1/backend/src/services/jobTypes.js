/**
 * @typedef {Object} JobRow
 * @property {string} email
 * @property {string} firstname
 * @property {string} lastname
 * @property {string} phone
 * @property {string} company
 * @property {string} companyurl
 * @property {string} city
 * @property {string} country
 * @property {string} designation
 * @property {string} industry
 * @property {string} company_size
 * @property {string} lead_type
 * @property {string} source
 * @property {string} tags
 * @property {string} notes
 */

/**
 * @typedef {Object} ProcessedRowOutput
 * @property {string} subject
 * @property {string} body
 * @property {number} personalization_score
 * @property {number} cultural_fit_score
 * @property {number} reply_likelihood_score
 * @property {string} language_mode
 * @property {string} reasoning_summary
 * @property {Array<{style: string, subject: string, open_rate_score: number, reason: string}>} [variants]
 */

/**
 * @typedef {Object} ProcessedRowResult
 * @property {string} email
 * @property {string} firstname
 * @property {string} lastname
 * @property {string} phone
 * @property {string} company
 * @property {string} companyurl
 * @property {string} city
 * @property {string} country
 * @property {string} designation
 * @property {string} industry
 * @property {string} company_size
 * @property {string} lead_type
 * @property {string} source
 * @property {string} tags
 * @property {string} notes
 * @property {string} name derived display name (firstname + lastname)
 * @property {'queued' | 'processing' | 'completed' | 'failed' | 'retrying'} status
 * @property {ProcessedRowOutput | null} output
 * @property {string} [error]
 */

/**
 * @typedef {Object} JobRecord
 * @property {string} jobId
 * @property {'queued' | 'processing' | 'partial_complete' | 'completed' | 'failed' | 'retrying'} status
 * @property {string} createdAt
 * @property {string} expiresAt ISO timestamp — job is purged after this time
 * @property {number} totalRows
 * @property {number} processedRows
 * @property {number} successCount
 * @property {number} failureCount
 * @property {ProcessedRowResult[]} data
 * @property {boolean} retryable
 */

module.exports = {};
