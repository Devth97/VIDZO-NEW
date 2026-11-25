import { userRoute, body } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { createServerQuote } from '@/lib/server/jobs';

export const POST = userRoute(async (req, ctx) => { const input = await body(req, 2000); const db = await getDb(); return db.tx(q => createServerQuote(q, ctx, input)); });
