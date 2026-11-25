import { userRoute } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { completeUpload } from '@/lib/server/assets';

export const POST = userRoute(async (_req, ctx, { id }) => { const db = await getDb(); return { asset: await db.tx(q => completeUpload(q, ctx, id)) }; });
