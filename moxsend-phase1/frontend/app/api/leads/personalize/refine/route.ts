export const runtime = 'nodejs';

type Body = {
  leadId: string;
  currentEmail: string;
  refinementPrompt: string;
  leadRecord?: unknown;
};

type RefineJson = {
  subject: string;
  body: string;
};

function parseCurrent(currentEmail: string): { subject: string; bodyHtml: string } | null {
  const raw = String(currentEmail ?? '').trim();
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { subject?: unknown; bodyHtml?: unknown };
    const subject = String(o.subject ?? '').trim();
    const bodyHtml = String(o.bodyHtml ?? '').trim();
    if (subject && bodyHtml) return { subject, bodyHtml };
  } catch {
    /* fall through */
  }
  return null;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const leadId = String(body.leadId ?? '').trim();
  const refinementPrompt = String(body.refinementPrompt ?? '').trim();
  const parsed = parseCurrent(body.currentEmail);
  const leadRecord = (body as Body).leadRecord;

  if (!leadId) {
    return Response.json({ success: false, error: 'leadId is required' }, { status: 400 });
  }
  if (!refinementPrompt) {
    return Response.json({ success: false, error: 'refinementPrompt is required' }, { status: 400 });
  }
  if (!parsed) {
    return Response.json(
      { success: false, error: 'currentEmail must be JSON { subject, bodyHtml }' },
      { status: 400 },
    );
  }

  try {
    const internalApiOrigin = (process.env.INTERNAL_API_ORIGIN ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
    const orchestratorRes = await fetch(`${internalApiOrigin}/api/ai/refine-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        lead: leadRecord ?? { leadId },
        baseEmail: parsed.bodyHtml,
        baseSubject: parsed.subject,
        refinementPrompt,
      }),
    });

    const orchestratorData = await orchestratorRes.json();
    if (!orchestratorRes.ok || !orchestratorData.success) {
      const errMsg =
        (typeof orchestratorData.error === 'object' ? orchestratorData.error?.message : orchestratorData.error) ||
        orchestratorData.message ||
        'Refinement failed from backend';
      throw new Error(errMsg);
    }

    const subject = String(orchestratorData.email?.subject ?? '').trim();
    const bodyHtml = String(orchestratorData.email?.bodyHtml ?? '').trim();
    if (!subject || !bodyHtml) throw new Error('Backend returned empty subject/bodyHtml');

    const email = JSON.stringify({ subject, bodyHtml });
    return Response.json({ success: true, email });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Refinement failed';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
