import { userRoute } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { assetUrl } from '@/lib/server/assets';

export const GET = userRoute(async (req, ctx, { id }) => assetUrl(await getDb(), ctx, id, new URL(req.url).searchParams.get('download') === '1'));
