import { userRoute, body } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { loadProject, saveProject, softDeleteProject } from '@/lib/server/repo';

export const GET = userRoute(async (_req, ctx, { id }) => ({ project: await loadProject(await getDb(), ctx, id) }));
export const PUT = userRoute(async (req, ctx, { id }) => {
  const input = (await body(req, 500_000)) as { project?: unknown; expectedRevision?: unknown };
  const db = await getDb();
  return { project: await db.tx(q => saveProject(q, ctx, id, input.project, Number(input.expectedRevision))) };
});
export const DELETE = userRoute(async (_req, ctx, { id }) => { const db = await getDb(); await db.tx(q => softDeleteProject(q, ctx, id)); return { ok: true }; });
