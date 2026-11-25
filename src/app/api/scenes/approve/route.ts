import { userRoute, body } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { approve } from '@/lib/server/repo';

export const POST = userRoute(async (req, ctx) => {
  const i = (await body(req, 2000)) as { projectId?: string; sceneId?: string; frameAssetId?: string };
  const db = await getDb();
  return { project: await db.tx(q => approve(q, ctx, String(i.projectId), String(i.sceneId), String(i.frameAssetId))) };
});
