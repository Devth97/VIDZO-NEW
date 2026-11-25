import { userRoute, body } from '@/lib/server/http';
import { simulateWebhook } from '@/lib/server/payments';
import { mode } from '@/lib/server/config';
import { HttpError } from '@/lib/server/errors';

/** LOCAL TEST BACKEND ONLY: sends a correctly signed test event through the real webhook handler. */
export const POST = userRoute(async (req, ctx) => {
  if (mode() !== 'local') throw new HttpError(404, 'Not found.');
  const i = (await body(req, 1000)) as { orderId?: string; outcome?: string };
  return simulateWebhook(ctx, String(i.orderId), i.outcome === 'failed' ? 'failed' : 'captured');
});
