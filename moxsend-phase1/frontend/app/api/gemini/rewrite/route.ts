import { generateText } from '@ai/model';
import { getPrompts } from '@ai/model/prompts/promptRegistry';

export const runtime = 'nodejs';

/** When the model returns subject plus HTML, keep a single plain subject line. */
function extractSubjectLineOnly(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/^```(?:\w*)?\s*([\s\S]*?)```$/im);
  if (fence) s = fence[1].trim();

  const lines = s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  s = lines[0] ?? s;

  s = s.replace(/^(subject|re|fw|fwd)\s*:\s*/i, '').trim();

  const tagAt = s.search(/<\s*[a-z]/i);
  if (tagAt >= 0) s = s.slice(0, tagAt).trim();

  const para = s.split(/\n\n/)[0]?.trim() ?? s;
  return para.split(/\r?\n/)[0]?.trim() ?? para;
}

type Body = {
  field: 'subject' | 'body';
  text: string;
  campaignTitle?: string;
  audienceSummary?: string;
  offerContext?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const field = body.field;
    const text = (body.text ?? '').trim();
    if (!text) {
      return Response.json({ error: 'text is required' }, { status: 400 });
    }
    if (field !== 'subject' && field !== 'body') {
      return Response.json({ error: 'field must be subject or body' }, { status: 400 });
    }

    const ctx = [
      body.campaignTitle ? `Campaign title: ${body.campaignTitle}` : '',
      body.audienceSummary ? `Audience: ${body.audienceSummary}` : '',
      body.offerContext ? `Offer / value prop: ${body.offerContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = getPrompts().buildRewritePrompt({
      field,
      text,
      contextBlock: ctx,
    });

    const rewritten = await generateText(prompt, {
      temperature: field === 'subject' ? 0.55 : 0.7,
      maxOutputTokens: field === 'subject' ? 128 : 3072,
    });
    const out =
      field === 'subject' ? extractSubjectLineOnly(rewritten) : rewritten.trim();

    if (field === 'subject' && !out) {
      return Response.json({ error: 'Model returned an empty subject; try again.' }, { status: 502 });
    }

    return Response.json({ ok: true, text: out });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Rewrite failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
