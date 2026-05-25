import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const endpoint = process.env.BATCH_PERSONALIZE_AI_ENDPOINT;
    
    if (!endpoint) {
      return NextResponse.json({ error: "BATCH_PERSONALIZE_AI_ENDPOINT not configured in .env" }, { status: 500 });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Python batch endpoint error: ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Batch personalization failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
