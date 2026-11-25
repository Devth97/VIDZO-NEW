import { userRoute, body } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { createProject } from '@/lib/server/repo';

export const POST = userRoute(async (req, ctx) => {
  const { name } = (await body(req, 2000)) as { name?: unknown };
  const db = await getDb();
  return { project: await db.tx(q => createProject(q, ctx, typeof name === 'string' ? name : 'Untitled project')) };
});
