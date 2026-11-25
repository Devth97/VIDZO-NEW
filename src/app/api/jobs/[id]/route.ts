import { userRoute } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { advanceJob, jobView } from '@/lib/server/jobs';

/** Polling also advances the job (lease-protected), so progress continues even without a background runner. */
export const GET = userRoute(async (_req, ctx, { id }) => {
  const db = await getDb();
  const view = await jobView(db, ctx.workspaceId, id);
  if (['queued', 'submitted', 'running'].includes(view.status)) { await advanceJob(id).catch(() => undefined); return jobView(db, ctx.workspaceId, id); }
  return view;
});
