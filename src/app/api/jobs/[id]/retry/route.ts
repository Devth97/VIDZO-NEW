import { userRoute } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { createServerQuote, jobView } from '@/lib/server/jobs';
import { HttpError } from '@/lib/server/errors';

/** A retry is a fresh quote for the work that is still missing; the user consents again before any credits are held. */
export const POST = userRoute(async (_req, ctx, { id }) => {
  const db = await getDb();
  const job = await jobView(db, ctx.workspaceId, id);
  if (job.kind === 'analysis') throw new HttpError(400, 'Start a new analysis from the project instead.');
  const [row] = await db.query<{ input: { tier?: 'professional' | 'premium' }; target_id: string | null }>('select j.input, q.target_id from public.jobs j left join public.quotes q on q.id = j.quote_id where j.id = $1', [id]);
  return db.tx(q => createServerQuote(q, ctx, { projectId: job.projectId, tier: row.input.tier ?? 'professional', scope: job.kind, targetId: row.target_id ?? undefined }));
});
