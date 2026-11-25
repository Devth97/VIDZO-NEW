import { userRoute, body } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { z } from 'zod';

const input = z.object({ subject: z.string().trim().min(3).max(150), body: z.string().trim().min(10).max(5000), projectId: z.uuid().optional(), jobId: z.uuid().optional() });
export const POST = userRoute(async (req, ctx) => {
  const i = input.parse(await body(req, 20_000));
  const db = await getDb();
  const own = async (table: 'projects' | 'jobs', id?: string) => (id ? (await db.query(`select 1 from public.${table} where id = $1 and workspace_id = $2`, [id, ctx.workspaceId])).length > 0 : false);
  const [row] = await db.query<{ id: string }>('insert into public.support_tickets(workspace_id, user_id, project_id, job_id, subject, body) values ($1,$2,$3,$4,$5,$6) returning id',
    [ctx.workspaceId, ctx.userId, (await own('projects', i.projectId)) ? i.projectId : null, (await own('jobs', i.jobId)) ? i.jobId : null, i.subject, i.body]);
  return { id: row.id };
});
export const GET = userRoute(async (_req, ctx) => ({ tickets: await (await getDb()).query('select id, subject, status, created_at from public.support_tickets where workspace_id = $1 order by created_at desc limit 50', [ctx.workspaceId]) }));
