import { userRoute, body } from '@/lib/server/http';
import { after } from 'next/server';
import { drive, startAnalysis } from '@/lib/server/jobs';

export const POST = userRoute(async (req, ctx) => {
  const { projectId } = (await body(req, 2000)) as { projectId?: string };
  const job = await startAnalysis(ctx, String(projectId));
  after(() => drive(job.id, 5 * 60_000));
  return Response.json(job, { status: 202 });
});
