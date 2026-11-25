import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Ctx } from './auth';
import { live, localSecret, mode, pricing } from './config';
import { getDb, type Queryable } from './db';
import { HttpError } from './errors';

/** Local test backend signs simulated webhooks with a key derived from its local secret. */
export const localWebhookSecret = () => createHmac('sha256', localSecret()).update('razorpay-webhook').digest('hex');
export const webhookSecret = () => (mode() === 'local' ? localWebhookSecret() : live.razorpay()?.webhookSecret);

export function signWebhook(body: string, secret: string) { return createHmac('sha256', secret).update(body).digest('hex'); }
export function verifyWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const a = Buffer.from(signWebhook(body, secret), 'hex'), b = Buffer.from(signature, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createOrder(q: Queryable, ctx: Ctx, packId: unknown) {
  const pr = pricing();
  if (!pr) throw new HttpError(503, 'Credit packs are not available until pricing is configured.', 'not_configured');
  const pack = pr.packs.find(p => p.id === packId);
  if (!pack) throw new HttpError(400, 'Choose a credit pack.', 'invalid_pack');
  const id = crypto.randomUUID();
  let orderId: string, keyId: string | undefined;
  if (mode() === 'local') orderId = 'order_local_' + id.replace(/-/g, '').slice(0, 14);
  else {
    const cfg = live.razorpay();
    if (!cfg) throw new HttpError(503, 'Payments are not configured yet.', 'not_configured');
    // NOT VERIFIED against a live merchant account.
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: 'Basic ' + Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: pack.paise, currency: 'INR', receipt: id, notes: { payment: id, pack: pack.id } }),
    });
    if (!res.ok) throw new HttpError(502, 'The payment provider could not create an order. Nothing was charged.', 'provider_error');
    const json = await res.json() as { id?: string; amount?: number; currency?: string };
    if (!json.id || json.amount !== pack.paise || json.currency !== 'INR') throw new HttpError(502, 'The payment order did not match the selected pack. Nothing was charged.', 'provider_error');
    orderId = json.id; keyId = cfg.keyId;
  }
  await q.query("insert into public.payments(id, workspace_id, user_id, provider, order_id, pack_id, credits, amount_paise, currency, status) values ($1,$2,$3,'razorpay',$4,$5,$6,$7,'INR','created')",
    [id, ctx.workspaceId, ctx.userId, orderId, pack.id, pack.credits, pack.paise]);
  return { paymentId: id, orderId, amount: pack.paise, currency: 'INR', credits: pack.credits, keyId, simulated: mode() === 'local' };
}

const eventSchema = z.object({
  event: z.string(),
  payload: z.object({ payment: z.object({ entity: z.object({ id: z.string(), order_id: z.string().nullable(), amount: z.number().int(), currency: z.string(), status: z.string() }) }).optional() }).passthrough(),
});

/**
 * Razorpay webhook: HMAC-SHA256 over the exact raw body, de-duplicated by event id, credits granted only from
 * a captured payment whose amount/currency match our order. Client-side checkout callbacks never grant credits.
 * Out-of-order events are safe: a late `payment.failed` cannot undo a capture.
 */
export async function handleRazorpayWebhook(rawBody: string, signature: string | null, eventId: string | null) {
  const secret = webhookSecret();
  if (!secret) throw new HttpError(503, 'Payments are not configured yet.', 'not_configured');
  if (!verifyWebhookSignature(rawBody, signature, secret)) throw new HttpError(401, 'Invalid signature.', 'bad_signature');
  const evt = eventSchema.parse(JSON.parse(rawBody));
  const id = eventId && eventId.length <= 100 ? eventId : 'body:' + signWebhook(rawBody, 'event-id');
  const db = await getDb();
  return db.tx(async q => {
    const inserted = await q.query("insert into public.webhook_events(provider, event_id, type) values ('razorpay', $1, $2) on conflict do nothing returning event_id", [id, evt.event]);
    if (!inserted.length) return { outcome: 'duplicate_event' };
    const p = evt.payload.payment?.entity;
    let outcome = 'ignored';
    if (p?.order_id && (evt.event === 'payment.captured' || evt.event === 'order.paid') && p.status === 'captured') {
      const [r] = await q.query<{ outcome: string }>("select public.payment_capture('razorpay', $1, $2, $3, $4) as outcome", [p.order_id, p.id, p.amount, p.currency]);
      outcome = r.outcome;
    } else if (p?.order_id && evt.event === 'payment.failed') {
      await q.query("update public.payments set status = 'failed', failure_reason = 'provider_reported_failure' where provider = 'razorpay' and order_id = $1 and status = 'created'", [p.order_id]);
      outcome = 'failed_recorded';
    }
    await q.query("update public.webhook_events set outcome = $2, processed_at = now() where provider = 'razorpay' and event_id = $1", [id, outcome]);
    return { outcome };
  });
}

export async function listPayments(q: Queryable, ws: string) {
  return (await q.query<{ id: string; pack_id: string; credits: number; amount_paise: number; currency: string; status: string; created_at: Date; captured_at: Date | null; order_id: string }>('select id, pack_id, credits, amount_paise, currency, status, created_at, captured_at, order_id from public.payments where workspace_id = $1 order by created_at desc limit 50', [ws]))
    .map(p => ({ id: p.id, packId: p.pack_id, credits: p.credits, amountPaise: p.amount_paise, currency: p.currency, status: p.status, createdAt: new Date(p.created_at).toISOString(), capturedAt: p.captured_at ? new Date(p.captured_at).toISOString() : null, simulated: p.order_id.startsWith('order_local_') }));
}

/** LOCAL ONLY: builds a provider-shaped event for an existing order and sends it through the real webhook handler. */
export async function simulateWebhook(ctx: Ctx, orderId: string, outcome: 'captured' | 'failed', tamperAmount = false) {
  if (mode() !== 'local') throw new HttpError(404, 'Not found.');
  const db = await getDb();
  const [pay] = await db.query<{ amount_paise: number; currency: string }>('select amount_paise, currency from public.payments where order_id = $1 and workspace_id = $2', [orderId, ctx.workspaceId]);
  if (!pay) throw new HttpError(404, 'Order not found.');
  const body = JSON.stringify({ event: outcome === 'captured' ? 'payment.captured' : 'payment.failed', payload: { payment: { entity: { id: 'pay_local_' + crypto.randomUUID().slice(0, 12), order_id: orderId, amount: pay.amount_paise + (tamperAmount ? 1 : 0), currency: pay.currency, status: outcome } } } });
  return handleRazorpayWebhook(body, signWebhook(body, localWebhookSecret()), 'evt_local_' + crypto.randomUUID());
}
