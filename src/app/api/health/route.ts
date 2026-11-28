import { NextResponse } from 'next/server';
import { mode } from '@/lib/server/config';
import { getDb } from '@/lib/server/db';
import { runnerBeat } from '@/lib/server/jobs';

export const dynamic = 'force-dynamic';

/** Minimal readiness probe: never returns database identifiers, errors or secrets. */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (mode() === 'demo') return NextResponse.json({ status: 'demo' }, { headers });
  try {
    const db = await getDb();
    await db.query('select 1');
    // Seconds since the background job runner last swept: lets a deploy check confirm the cron is firing.
    const beat = await runnerBeat(db).catch(() => null);
    const runnerAgeSeconds = beat ? Math.round((Date.now() - new Date(beat.at).getTime()) / 1000) : null;
    return NextResponse.json({ status: 'ok', runnerAgeSeconds }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URI]') : 'Unknown database error';
    console.error('[vidzo] readiness failed:', message);
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
