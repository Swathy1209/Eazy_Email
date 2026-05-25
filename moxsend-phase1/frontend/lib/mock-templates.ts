export type EmailTemplate = {
  id: string;
  name: string;
  category: string;
  subject: string;
  html: string;
  snippet: string;
};

const TEMPLATES: EmailTemplate[] = [
  {
    id: 'intro-value',
    name: 'Value-forward intro',
    category: 'Outbound',
    subject: 'A better way to reach {{company}}’s buyers',
    html: '<p>Hi {{name}},</p>\n<p>Teams like {{company}} in {{industry}} often balance speed with personalization — here’s a concise angle that might resonate.</p>\n<p>Open to a quick chat next week?</p>',
    snippet: '<p>P.S. Tailored for {{role}} in {{city}}.</p>',
  },
  {
    id: 'follow-up',
    name: 'Polite follow-up',
    category: 'Follow-up',
    subject: 'Circling back — {{company}}',
    html: '<p>Hi {{name}},</p>\n<p>Wanted to bump this above the fold. If timing was off, totally understood.</p>\n<p>Reply with a good window and I’ll adapt.</p>',
    snippet: '<p>Alternatively, here’s a one-liner on outcomes: higher reply rates without sacrificing brand voice.</p>',
  },
  {
    id: 'event',
    name: 'Webinar / event',
    category: 'Events',
    subject: 'Invite: short session for {{industry}} leaders',
    html: '<p>Hi {{name}},</p>\n<p>We’re hosting a focused session for operators in {{region}} — practical workflows, no fluff.</p>\n<p>Can I send you the calendar hold?</p>',
    snippet: '<p>Agenda fits {{role}} priorities in under 25 minutes.</p>',
  },
  {
    id: 'enterprise',
    name: 'Enterprise tone',
    category: 'Enterprise',
    subject: '{{company}} — security-first rollout options',
    html: '<p>Hi {{name}},</p>\n<p>For enterprises in {{industry}}, we document data handling, access controls, and a phased rollout that matches procurement cadence.</p>\n<p>Happy to share the one-pager.</p>',
    snippet: '<p>Reference: {{website}}</p>',
  },
];

export function listTemplates(): EmailTemplate[] {
  return [...TEMPLATES];
}

export function searchTemplates(query: string): EmailTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return listTemplates();
  return TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.id.includes(q),
  );
}
