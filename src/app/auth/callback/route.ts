import { NextResponse, type NextRequest } from 'next/server';
import { safeNext, supabaseServer } from '@/lib/server/auth';
import { mode } from '@/lib/server/config';

/** Supabase Google callback (PKCE). Exchanges the one-time code for a session cookie, then returns to the draft. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const failure = new URL('/signin', url);
  failure.searchParams.set('error', 'google');
  failure.searchParams.set('next', next);
  const redirect = (target: URL) => NextResponse.redirect(target, { headers: { 'Cache-Control': 'no-store' } });
  if (mode() !== 'live' || !code || url.searchParams.has('error')) return redirect(failure);
  try {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (error) throw error;
    return redirect(new URL(next, url));
  } catch {
    return redirect(failure);
  }
}
