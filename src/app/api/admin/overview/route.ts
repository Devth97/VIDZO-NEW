import { adminRoute } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { limits } from '@/lib/server/jobs';
import { getStorage } from '@/lib/server/storage';

export const GET = adminRoute(async () => {
  const db = await getDb();
  const jobs = await db.query(`select j.id, j.kind, j.status, j.stage, j.error, j.needs_attention, j.credits_reserved, j.credits_settled, j.created_at, j.project_id, p.email,
      coalesce((select json_agg(json_build_object('task', a.task_id, 'kind', a.kind, 'provider', a.provider, 'endpoint', a.endpoint, 'status', a.status, 'tries', a.tries, 'requestId', a.request_id, 'error', a.error) order by a.created_at) from public.attempts a where a.job_id = j.id), '[]') as attempts
    from public.jobs j join public.profiles p on p.user_id = j.user_id order by j.needs_attention desc, j.created_at desc limit 60`);
  const qa = await db.query<{ id: string; object_key: string; mime: string; placeholder: boolean; project_id: string; created_at: Date; name: string }>(`select a.id, a.object_key, a.mime, a.placeholder, a.project_id, a.created_at, p.doc->>'name' as name from public.assets a join public.projects p on p.id = a.project_id
    where a.kind = 'export' and a.status = 'verified' and not exists (select 1 from public.qa_reviews r where r.export_asset_id = a.id and r.decision <> 'pending') order by a.created_at limit 30`);
  const storage = await getStorage();
  const queue = await Promise.all(qa.map(async a => ({ id: a.id, projectId: a.project_id, name: a.name, placeholder: a.placeholder, mime: a.mime, createdAt: a.created_at, url: await storage.signGet(a.object_key, { mime: a.mime }) })));
  const [today] = await db.query<{ credits: string }>("select coalesce(sum(credits_reserved), 0) credits from public.jobs where created_at > date_trunc('day', now()) and status <> 'failed'");
  const tickets = await db.query("select t.id, t.subject, t.body, t.status, t.created_at, t.project_id, t.job_id, p.email from public.support_tickets t join public.profiles p on p.user_id = t.user_id where t.status = 'open' order by t.created_at desc limit 50");
  const payments = await db.query('select id, order_id, pack_id, credits, amount_paise, status, failure_reason, created_at from public.payments order by created_at desc limit 30');
  return { jobs, qa: queue, limits: await limits(db), committedCreditsToday: Number(today.credits), tickets, payments };
});
