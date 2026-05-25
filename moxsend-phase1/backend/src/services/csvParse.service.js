const fs = require('fs');
const csv = require('csv-parser');
const { AppError } = require('../utils/AppError');
const {
  MAX_DATA_ROWS,
  MANDATORY_HEADERS,
  OPTIONAL_HEADERS,
} = require('./csvConstants');

/**
 * @param {string} value
 */
function trimCell(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/**
 * @param {string} header
 */
function normalizeHeader(header) {
  return trimCell(String(header).replace(/^\ufeff/, ''));
}

/**
 * Ensures every mandatory column exists in the header list.
 * @param {string[]} headers
 */
function assertRequiredHeaders(headers) {
  const lowerToActual = new Map();
  for (const h of headers) {
    const t = normalizeHeader(h);
    if (!t) continue;
    lowerToActual.set(t.toLowerCase(), t);
  }

  for (const required of MANDATORY_HEADERS) {
    if (!lowerToActual.has(required.toLowerCase())) {
      throw new AppError(
        `CSV must include header "${required}" (case-insensitive).`,
        400,
        'MISSING_HEADER',
      );
    }
  }
}

/**
 * Maps canonical field names to the actual header keys present in the file.
 * @param {string[]} headers
 */
function buildCanonicalKeyMap(headers) {
  /** @type {Record<string, string | undefined>} */
  const map = {};
  const lowerToActual = new Map();
  for (const h of headers) {
    const t = normalizeHeader(h);
    if (!t) continue;
    lowerToActual.set(t.toLowerCase(), t);
  }
  for (const field of MANDATORY_HEADERS) {
    map[field] = lowerToActual.get(field.toLowerCase());
  }
  for (const field of OPTIONAL_HEADERS) {
    map[field] = lowerToActual.get(field.toLowerCase());
  }
  return map;
}

/**
 * @param {Record<string, string>} row
 * @param {Record<string, string | undefined>} canonicalKeyMap
 */
function normalizeRow(row, canonicalKeyMap) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const canonical of [...MANDATORY_HEADERS, ...OPTIONAL_HEADERS]) {
    const sourceKey = canonicalKeyMap[canonical];
    out[canonical] = sourceKey ? trimCell(row[sourceKey]) : '';
  }
  return out;
}

/**
 * Streams and parses a CSV file.
 *
 * **Upload-time validation (strict):** file readable, parseable CSV, mandatory **headers** present.
 * **Row-level validation (relaxed here):** every data line becomes a row object (trimmed).
 *
 * @param {string} filePath
 * @returns {Promise<{ rows: import('./jobTypes').JobRow[], headers: string[] }>}
 */
function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    /** @type {string[] | null} */
    let headers = null;
    /** @type {Record<string, string | undefined> | null} */
    let canonicalKeyMap = null;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const ok = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const stream = fs.createReadStream(filePath, { encoding: 'utf8' }).on(
      'error',
      () => {
        fail(new AppError('Unable to read uploaded file.', 400, 'FILE_READ_ERROR'));
      },
    );

    stream
      .pipe(
        csv({
          mapHeaders: ({ header }) => normalizeHeader(header),
          mapValues: ({ value }) => trimCell(value),
          strict: false,
        }),
      )
      .on('headers', (hdrs) => {
        headers = hdrs.map(normalizeHeader);
        try {
          assertRequiredHeaders(headers);
          canonicalKeyMap = buildCanonicalKeyMap(headers);
        } catch (err) {
          stream.destroy();
          fail(err);
        }
      })
      .on('data', (data) => {
        if (!canonicalKeyMap || settled) return;

        if (rows.length >= MAX_DATA_ROWS) {
          stream.destroy();
          fail(
            new AppError(
              `CSV exceeds maximum of ${MAX_DATA_ROWS} data rows.`,
              413,
              'ROW_LIMIT_EXCEEDED',
            ),
          );
          return;
        }

        const normalized = normalizeRow(data, canonicalKeyMap);

        rows.push(
          /** @type {import('./jobTypes').JobRow} */ ({
            email: normalized.email,
            firstname: normalized.firstname,
            lastname: normalized.lastname,
            phone: normalized.phone,
            company: normalized.company,
            companyurl: normalized.companyurl,
            city: normalized.city,
            country: normalized.country,
            designation: normalized.designation,
            industry: normalized.industry,
            company_size: normalized.company_size,
            lead_type: normalized.lead_type,
            source: normalized.source,
            tags: normalized.tags,
            notes: normalized.notes,
          }),
        );
      })
      .on('error', (err) => {
        if (settled) return;
        // eslint-disable-next-line no-console
        console.error('CSV parser error:', err);
        fail(new AppError('Failed to parse CSV.', 400, 'CSV_PARSE_ERROR'));
      })
      .on('end', () => {
        if (settled) return;
        if (!headers || !canonicalKeyMap) {
          fail(
            new AppError(
              'CSV is empty or missing a header row.',
              400,
              'INVALID_CSV',
            ),
          );
          return;
        }
        ok({ rows, headers });
      });
  });
}

module.exports = {
  parseCsvFile,
  normalizeHeader,
};
