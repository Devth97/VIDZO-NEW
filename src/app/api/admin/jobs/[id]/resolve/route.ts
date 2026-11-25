import { adminRoute, body } from '@/lib/server/http';
import { resolveUnknown } from '@/lib/server/jobs';

export const POST = adminRoute(async (req, _ctx, { id }) => {
  const { action } = (await body(req, 500)) as { action?: string };
  await resolveUnknown(id, action === 'resubmit' ? 'resubmit' : 'mark_failed');
  return { ok: true };
});
