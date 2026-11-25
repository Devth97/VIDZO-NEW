import { NextResponse } from 'next/server';
import { mode } from '@/lib/server/config';
import { getDb } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/** Minimal readiness probe: never returns database identifiers, errors or secrets. */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (mode() === 'demo') return NextResponse.json({ status: 'demo' }, { headers });
  try {
    await (await getDb()).query('select 1');
    return NextResponse.json({ status: 'ok' }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URI]') : 'Unknown database error';
    console.error('[vidzo] readiness failed:', message);
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
