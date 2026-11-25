import { publicRoute, body } from '@/lib/server/http';
import { safeNext, supabaseServer } from '@/lib/server/auth';
import { live, mode } from '@/lib/server/config';
import { HttpError } from '@/lib/server/errors';

export const POST = publicRoute(async req => {
  if (mode() !== 'live') throw new HttpError(404, 'Google sign-in is only available in live mode.', 'not_available');
  const input = (await body(req, 2000)) as { next?: unknown; accept?: unknown } | null;
  if (input?.accept !== true) throw new HttpError(400, 'Please accept the beta terms and privacy notice.', 'terms');
  // Use deployment configuration, never a user-supplied host, for the OAuth callback.
  const origin = live.appOrigin();
  if (!origin) throw new HttpError(503, 'Google sign-in is not configured yet.', 'not_configured');
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', safeNext(input.next));
  const { data, error } = await (await supabaseServer()).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new HttpError(503, 'Google sign-in could not start. Please try again.', 'oauth_failed');
  // @supabase/ssr writes the PKCE verifier cookie; no provider tokens are sent in this response.
  return { url: data.url };
});
