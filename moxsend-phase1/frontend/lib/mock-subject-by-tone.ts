export type SubjectTone = 'curious' | 'urgent' | 'friendly' | 'professional' | 'bold';

function compactOfferText(raw?: string): string {
  const src = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!src) return 'a growth opportunity';
  const cleaned = src
    .replace(/^(offering|we offer|offer|offre|providing)\s+/i, '')
    .replace(/[.]+$/g, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 10) return cleaned;
  return `${words.slice(0, 10).join(' ')}...`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

export function mockSubjectLine(params: {
  tone: SubjectTone;
  company: string;
  name: string;
  offerSnippet?: string;
  role?: string;
  industry?: string;
}): string {
  const { tone, company, name, offerSnippet, role, industry } = params;
  const first = firstName(name);
  const co = company.trim() || 'your team';
  const offer = compactOfferText(offerSnippet);
  const roleHint = role?.trim() ? ` for your ${role.trim()} team` : '';
  const industryHint = industry?.trim() ? ` in ${industry.trim()}` : '';

  const templates: Record<SubjectTone, string> = {
    curious: `{{name}}, open to ${offer}${roleHint}?`,
    urgent: `${co}: quick window for ${offer}${industryHint}`,
    friendly: `Hey ${first} — thought of {{company}} for ${offer}`,
    professional: `Proposal for {{company}}: ${offer}${roleHint}`,
    bold: `${co} can move fast on ${offer}`,
  };

  return templates[tone];
}
