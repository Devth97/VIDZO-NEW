import { adminRoute, body } from '@/lib/server/http';
import { HttpError } from '@/lib/server/errors';
import { resolveActions, resolveUnknown } from '@/lib/server/jobs';

export const POST = adminRoute(async (req, _ctx, { id }) => {
  const { action } = (await body(req, 500)) as { action?: string };
  const chosen = resolveActions.find(a => a === action);
  if (!chosen) throw new HttpError(400, 'Unknown action.', 'invalid');
  await resolveUnknown(id, chosen);
  return { ok: true };
});
