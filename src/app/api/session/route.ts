import { NextResponse } from 'next/server';
import { capabilities, mode, pricing } from '@/lib/server/config';
import { sessionUser } from '@/lib/server/auth';
import { placeholderPricing } from '@/lib/domain/pricing';

export const dynamic = 'force-dynamic';
export async function GET() {
  const m = mode();
  let user: { email: string } | null = null;
  try { user = m === 'demo' ? null : await sessionUser(); } catch { user = null; }
  const pr = m === 'demo' ? placeholderPricing : pricing();
  return NextResponse.json({ mode: m, capabilities: capabilities(), signedIn: Boolean(user), email: user?.email ?? null, pricing: pr }, { headers: { 'Cache-Control': 'no-store' } });
}
