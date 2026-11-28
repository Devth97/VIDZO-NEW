import { userRoute } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { jobView } from '@/lib/server/jobs';

/** Status reads only observe persisted state. Progress comes from the background runner, never from polling. */
export const GET = userRoute(async (_req, ctx, { id }) => jobView(await getDb(), ctx.workspaceId, id));
