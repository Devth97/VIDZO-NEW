import { publicRoute, body } from '@/lib/server/http';
import { createLocalSignInLink, normalizeEmail, safeNext, supabaseServer, assertLoopback } from '@/lib/server/auth';
import { live, mode } from '@/lib/server/config';
import { HttpError } from '@/lib/server/errors';

export const POST = publicRoute(async req => {
  const input = (await body(req, 2000)) as { email?: unknown; next?: unknown; accept?: unknown };
  const email = normalizeEmail(input.email), next = safeNext(input.next);
  if (input.accept !== true) throw new HttpError(400, 'Please accept the beta terms and privacy notice.', 'terms');
  if (mode() === 'local') {
    await assertLoopback();
    const link = await createLocalSignInLink(email, next);
    console.info(`[vidzo local] sign-in link for ${email}: ${link}`);
    return { sent: true, localLink: link };
  }
  if (mode() !== 'live') throw new HttpError(404, 'Sign-in is not available in demo mode.', 'demo_mode');
  const origin = live.appOrigin() ?? new URL(req.url).origin;
  const { error } = await (await supabaseServer()).auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true } });
  if (error) throw new HttpError(429, 'We could not send a sign-in email right now. Please try again in a minute.', 'otp_failed');
  return { sent: true };
});
