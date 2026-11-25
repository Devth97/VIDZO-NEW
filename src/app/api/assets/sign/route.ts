import { userRoute, body } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { signUpload } from '@/lib/server/assets';

export const POST = userRoute(async (req, ctx) => { const db = await getDb(); const input = await body(req, 5000); return db.tx(q => signUpload(q, ctx, input)); });
