/**
 * RFC-style CSV field escaping for downloadable exports.
 * @param {unknown} val
 */
function escapeCsvField(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Builds a UTF-8 CSV string from processed job rows (Excel-friendly BOM).
 * @param {import('../services/jobTypes').ProcessedRowResult[]} rows
 */
function buildResultsCsv(rows) {
  const headers = [
    'email',
    'firstname',
    'lastname',
    'phone',
    'company',
    'companyurl',
    'city',
    'country',
    'designation',
    'industry',
    'company_size',
    'lead_type',
    'source',
    'tags',
    'notes',
    'status',
    'opening_line',
    'generated_email',
    'subject_1',
    'subject_2',
    'error',
  ];
  const lines = [headers.join(',')];

  for (const r of rows) {
    const o = r.output;
    lines.push(
      [
        escapeCsvField(r.email),
        escapeCsvField(r.firstname),
        escapeCsvField(r.lastname),
        escapeCsvField(r.phone),
        escapeCsvField(r.company),
        escapeCsvField(r.companyurl),
        escapeCsvField(r.city),
        escapeCsvField(r.country),
        escapeCsvField(r.designation),
        escapeCsvField(r.industry),
        escapeCsvField(r.company_size),
        escapeCsvField(r.lead_type),
        escapeCsvField(r.source),
        escapeCsvField(r.tags),
        escapeCsvField(r.notes),
        escapeCsvField(r.status),
        escapeCsvField(o?.openingLine ?? ''),
        escapeCsvField(o?.email ?? ''),
        escapeCsvField(o?.subjectLines?.[0]?.subject ?? ''),
        escapeCsvField(o?.subjectLines?.[1]?.subject ?? ''),
        escapeCsvField(r.error ?? ''),
      ].join(','),
    );
  }

  return `\ufeff${lines.join('\r\n')}`;
}

module.exports = {
  escapeCsvField,
  buildResultsCsv,
};
