import { publicRoute, body } from '@/lib/server/http';
import { createLocalSignInLink, normalizeEmail, safeNext, assertLoopback } from '@/lib/server/auth';
import { mode } from '@/lib/server/config';
import { HttpError } from '@/lib/server/errors';

export const POST = publicRoute(async req => {
  if (mode() !== 'local') throw new HttpError(404, 'Use Google to sign in. Email links are only available in the local test backend.', 'not_available');
  const input = (await body(req, 2000)) as { email?: unknown; next?: unknown; accept?: unknown };
  const email = normalizeEmail(input.email), next = safeNext(input.next);
  if (input.accept !== true) throw new HttpError(400, 'Please accept the beta terms and privacy notice.', 'terms');
  await assertLoopback();
  const link = await createLocalSignInLink(email, next);
  console.info(`[vidzo local] sign-in link for ${email}: ${link}`);
  return { sent: true, localLink: link };
});
