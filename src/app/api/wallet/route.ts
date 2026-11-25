import { userRoute } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { loadWallet } from '@/lib/server/repo';
import { listPayments } from '@/lib/server/payments';
import { pricing } from '@/lib/server/config';

export const GET = userRoute(async (_req, ctx) => {
  const db = await getDb();
  return { wallet: await loadWallet(db, ctx.workspaceId, 100), payments: await listPayments(db, ctx.workspaceId), pricing: pricing() };
});
