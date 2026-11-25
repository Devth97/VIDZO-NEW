import { userRoute, body } from '@/lib/server/http';
import { after } from 'next/server';
import { createJob, drive } from '@/lib/server/jobs';

export const POST = userRoute(async (req, ctx) => {
  const job = await createJob(ctx, await body(req, 2000));
  after(() => drive(job.id));
  return Response.json(job, { status: 202 });
});
