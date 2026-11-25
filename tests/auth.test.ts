import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => cookieJar.set(name, value),
  }),
  headers: async () => new Headers(),
}));

const start = async (input: unknown, origin = 'https://vidzo.tech') => {
  const { POST } = await import('@/app/api/auth/google/route');
  return POST(new NextRequest('https://vidzo.tech/api/auth/google', {
    method: 'POST', headers: { 'Content-Type': 'application/json', origin, host: 'vidzo.tech' },
    body: JSON.stringify(input),
  }), { params: Promise.resolve({}) });
};

beforeEach(() => {
  vi.stubEnv('VIDZO_MODE', 'live');
  vi.stubEnv('APP_ORIGIN', 'https://vidzo.tech');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://vidzo-auth.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');
  cookieJar.clear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Google sign-in', () => {
  it('starts Google OAuth with PKCE and returns to the requested draft', async () => {
    const response = await start({ accept: true, next: '/studio/draft-123?step=brand' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const url = new URL((await response.json()).url);
    expect(url.origin).toBe('https://vidzo-auth.example.test');
    expect(url.pathname).toBe('/auth/v1/authorize');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('code_challenge_method')).toBe('s256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    const callback = new URL(url.searchParams.get('redirect_to')!);
    expect(callback.origin + callback.pathname).toBe('https://vidzo.tech/auth/callback');
    expect(callback.searchParams.get('next')).toBe('/studio/draft-123?step=brand');
    expect([...cookieJar.keys()].some(name => name.includes('code-verifier'))).toBe(true);
  });

  it.each(['https://evil.test', '//evil.test', '/\\evil.test'])('rejects an external return path: %s', async next => {
    const response = await start({ accept: true, next });
    const url = new URL((await response.json()).url);
    expect(new URL(url.searchParams.get('redirect_to')!).searchParams.get('next')).toBe('/projects');
  });

  it('requires explicit terms acceptance before starting sign-in', async () => {
    expect((await start({ accept: false })).status).toBe(400);
    expect(cookieJar.size).toBe(0);
  });

  it('blocks cross-site initiation', async () => {
    expect((await start({ accept: true }, 'https://evil.test')).status).toBe(403);
    expect(cookieJar.size).toBe(0);
  });

  it.each(['demo', 'local'])('does not impersonate Google sign-in in %s mode', async mode => {
    vi.stubEnv('VIDZO_MODE', mode);
    expect((await start({ accept: true })).status).toBe(404);
  });

  it('requires a configured application origin', async () => {
    vi.stubEnv('APP_ORIGIN', '');
    expect((await start({ accept: true })).status).toBe(503);
  });

  it('does not require an email sender or permit live email sign-in', async () => {
    const { POST } = await import('@/app/api/auth/email/route');
    const response = await POST(new NextRequest('https://vidzo.tech/api/auth/email', {
      method: 'POST', headers: { host: 'vidzo.tech' },
      body: JSON.stringify({ email: 'buyer@example.test', accept: true }),
    }), { params: Promise.resolve({}) });
    expect(response.status).toBe(404);
  });

  it('preserves the draft after canceled Google consent without showing provider error text', async () => {
    const { GET } = await import('@/app/auth/callback/route');
    const response = await GET(new NextRequest('https://vidzo.tech/auth/callback?error=access_denied&error_description=private-provider-text&next=/studio/draft-123'));
    const url = new URL(response.headers.get('location')!);
    expect(url.pathname).toBe('/signin');
    expect(url.searchParams.get('next')).toBe('/studio/draft-123');
    expect(url.searchParams.get('error')).toBe('google');
    expect(url.toString()).not.toContain('private-provider-text');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('exchanges a valid callback code for session cookies and resumes the draft', async () => {
    await start({ accept: true, next: '/studio/draft-123' });
    const fetchMock = vi.fn(async () => Response.json({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_in: 3600, token_type: 'bearer',
      user: { id: 'test-user', email: 'buyer@example.test', aud: 'authenticated' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/auth/callback/route');
    const response = await GET(new NextRequest('https://vidzo.tech/auth/callback?code=test-code&next=/studio/draft-123'));
    expect(response.headers.get('location')).toBe('https://vidzo.tech/studio/draft-123');
    expect([...cookieJar].some(([name, value]) => name.endsWith('-auth-token') && value.length > 0)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not create a session when the callback code is rejected', async () => {
    await start({ accept: true });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'invalid_grant', error_description: 'Expired code' }, { status: 400 })));
    const { GET } = await import('@/app/auth/callback/route');
    const response = await GET(new NextRequest('https://vidzo.tech/auth/callback?code=expired&next=/studio/draft-123'));
    const url = new URL(response.headers.get('location')!);
    expect(url.pathname).toBe('/signin');
    expect(url.searchParams.get('next')).toBe('/studio/draft-123');
    expect([...cookieJar].some(([name, value]) => name.endsWith('-auth-token') && value.length > 0)).toBe(false);
  });
});
