/** Maximum number of non-blank data rows accepted per upload. */
const MAX_DATA_ROWS = 100;

/**
 * Mandatory CSV columns (case-insensitive header match).
 */
const MANDATORY_HEADERS = [
  'email',
  'firstname',
  'lastname',
  'phone',
  'company',
  'city',
  'country',
  'industry',
];

/** Optional columns — file may omit these headers entirely; values may be empty. */
const OPTIONAL_HEADERS = [
  'companyurl',
  'designation',
  'company_size',
  'lead_type',
  'source',
  'tags',
  'notes',
];

/** Full column order for sample CSV and normalized row shape. */
const ALL_HEADERS = [...MANDATORY_HEADERS, ...OPTIONAL_HEADERS];

/** Upload size guard — tune per infrastructure. */
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MiB

/** First N rows use minimal delay so the UI can show initial results quickly. */
const FAST_INITIAL_ROWS = 10;

module.exports = {
  MAX_DATA_ROWS,
  MANDATORY_HEADERS,
  OPTIONAL_HEADERS,
  ALL_HEADERS,
  MAX_FILE_BYTES,
  FAST_INITIAL_ROWS,
};
