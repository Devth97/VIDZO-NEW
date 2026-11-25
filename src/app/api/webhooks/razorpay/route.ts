import { NextResponse, type NextRequest } from 'next/server';
import { handleRazorpayWebhook } from '@/lib/server/payments';
import { toResponse } from '@/lib/server/errors';

/** Signed webhook. The raw body is verified before parsing; duplicate and out-of-order events are safe. */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 200_000) return NextResponse.json({ error: 'too large' }, { status: 413 });
    const result = await handleRazorpayWebhook(raw, req.headers.get('x-razorpay-signature'), req.headers.get('x-razorpay-event-id'));
    return NextResponse.json(result);
  } catch (e) { return toResponse(e); }
}
