import { adminRoute, body } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { z } from 'zod';
import { HttpError } from '@/lib/server/errors';

const input = z.object({ exportAssetId: z.uuid(), decision: z.enum(['approved', 'rejected']), note: z.string().max(2000).optional() });
export const POST = adminRoute(async (req, ctx) => {
  const i = input.parse(await body(req, 5000));
  const db = await getDb();
  const [a] = await db.query<{ workspace_id: string; project_id: string }>("select workspace_id, project_id from public.assets where id = $1 and kind = 'export' and status = 'verified'", [i.exportAssetId]);
  if (!a) throw new HttpError(404, 'Export not found.');
  if (i.decision === 'rejected' && !i.note?.trim()) throw new HttpError(400, 'Explain what must change so the customer and team can act on it.');
  await db.query('insert into public.qa_reviews(workspace_id, project_id, export_asset_id, decision, note, reviewer_id) values ($1,$2,$3,$4,$5,$6)', [a.workspace_id, a.project_id, i.exportAssetId, i.decision, i.note ?? null, ctx.userId]);
  return { ok: true };
});
