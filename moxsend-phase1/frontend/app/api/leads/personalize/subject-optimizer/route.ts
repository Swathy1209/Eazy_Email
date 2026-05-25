export const runtime = 'nodejs';

type Body = {
  subject_input?: string;
  subjectInput?: string;
  campaign_context?: string;
  campaignContext?: string;
  lead_context?: string;
  leadContext?: string;
  offer_context?: string;
  offerContext?: string;
  tone?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const subjectInput = String(body.subject_input ?? body.subjectInput ?? '').trim();
  if (!subjectInput) {
    return Response.json({ success: false, error: 'subject_input is required' }, { status: 400 });
  }

  try {
    const internalApiOrigin = (process.env.INTERNAL_API_ORIGIN ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
    const orchestratorRes = await fetch(`${internalApiOrigin}/api/ai/subject-optimizer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        subject_input: subjectInput,
        campaign_context: String(body.campaign_context ?? body.campaignContext ?? '').trim(),
        lead_context: String(body.lead_context ?? body.leadContext ?? '').trim(),
        offer_context: String(body.offer_context ?? body.offerContext ?? '').trim(),
        tone: String(body.tone ?? 'Professional').trim() || 'Professional',
      }),
    });

    const orchestratorData = await orchestratorRes.json();
    if (!orchestratorRes.ok || !orchestratorData.success) {
      const errMsg =
        (typeof orchestratorData.error === 'object' ? orchestratorData.error?.message : orchestratorData.error) ||
        orchestratorData.message ||
        'Subject optimizer failed from backend';
      throw new Error(errMsg);
    }

    return Response.json({
      success: true,
      variants: Array.isArray(orchestratorData.variants) ? orchestratorData.variants : [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Subject optimizer failed';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
