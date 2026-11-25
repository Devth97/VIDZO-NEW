import { userRoute } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { listProjects, loadWallet } from '@/lib/server/repo';

export const GET = userRoute(async (_req, ctx) => {
  const db = await getDb();
  return { projects: await listProjects(db, ctx), wallet: await loadWallet(db, ctx.workspaceId), role: ctx.isAdmin ? 'admin' : 'member', email: ctx.email, workspaceId: ctx.workspaceId };
});
