import { userRoute, body } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { createOrder } from '@/lib/server/payments';

export const POST = userRoute(async (req, ctx) => { const { packId } = (await body(req, 1000)) as { packId?: string }; return createOrder(await getDb(), ctx, packId); });
