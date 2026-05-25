import { generateJson } from '@ai/model';
import { getPrompts } from '@ai/model/prompts/promptRegistry';

export const runtime = 'nodejs';

type Body = {
  subject: string;
  bodyHtml: string;
  campaignTitle?: string;
  audienceSummary?: string;
  offerContext?: string;
};

type ArOut = {
  subject: string;
  bodyHtml: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const subject = body.subject ?? '';
    const bodyHtml = body.bodyHtml ?? '';
    if (!subject.trim() && !bodyHtml.trim()) {
      return Response.json({ error: 'subject or bodyHtml is required' }, { status: 400 });
    }

    const ctx = [
      body.campaignTitle ? `Campaign title: ${body.campaignTitle}` : '',
      body.audienceSummary ? `Audience: ${body.audienceSummary}` : '',
      body.offerContext ? `Offer / value prop: ${body.offerContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = getPrompts().buildTranslateArPrompt({
      subject,
      bodyHtml,
      contextBlock: ctx,
    });

    const parsed = await generateJson<ArOut>(prompt, {
      maxOutputTokens: 4096,
      temperature: 0.65,
    });
    if (typeof parsed.subject !== 'string' || typeof parsed.bodyHtml !== 'string') {
      return Response.json({ error: 'Invalid translation response shape' }, { status: 502 });
    }

    return Response.json({ ok: true, subject: parsed.subject, bodyHtml: parsed.bodyHtml });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Translation failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
