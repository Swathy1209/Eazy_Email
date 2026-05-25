const DEFAULT_STYLES = ['Curiosity', 'Urgency', 'Benefit', 'Personalised', 'Question-based'];

function buildSubjectLinePrompt({ brief, tone }, styles = DEFAULT_STYLES) {
  return [
    'You are an expert email copywriter.',
    'Generate exactly 5 high-performing email subject lines.',
    `Tone: ${tone}`,
    `Brief: ${brief}`,
    `Styles to include: ${styles.join(', ')}`,
    'Return ONLY valid JSON with this shape:',
    '{ "subjectLines": [{ "style": "Curiosity", "subject": "...", "score": 8, "reason": "..." }] }',
    'No markdown. No commentary.',
  ].join('\n');
}

module.exports = {
  DEFAULT_STYLES,
  buildSubjectLinePrompt,
};
