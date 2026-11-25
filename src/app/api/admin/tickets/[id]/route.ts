import { adminRoute } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
export const POST = adminRoute(async (_req, _ctx, { id }) => { await (await getDb()).query("update public.support_tickets set status = 'closed' where id = $1", [id]); return { ok: true }; });
