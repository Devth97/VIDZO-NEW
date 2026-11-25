import { NextResponse, type NextRequest } from 'next/server';
import { consumeLocalSignInLink, assertLoopback } from '@/lib/server/auth';
import { mode } from '@/lib/server/config';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (mode() !== 'local') return NextResponse.redirect(new URL('/signin', url));
  try {
    await assertLoopback();
    const next = await consumeLocalSignInLink(url.searchParams.get('token') ?? '');
    return NextResponse.redirect(new URL(next, url));
  } catch {
    return NextResponse.redirect(new URL('/signin?error=link', url));
  }
}
