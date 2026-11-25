import { NextResponse, type NextRequest } from 'next/server';
import { safeNext, supabaseServer } from '@/lib/server/auth';
import { mode } from '@/lib/server/config';

/** Supabase email-link callback (PKCE). Exchanges the one-time code for a session cookie, then returns to the draft. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  if (mode() !== 'live' || !code) return NextResponse.redirect(new URL('/signin?error=link', url));
  try {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (error) throw error;
    return NextResponse.redirect(new URL(next, url));
  } catch {
    return NextResponse.redirect(new URL('/signin?error=link', url));
  }
}
