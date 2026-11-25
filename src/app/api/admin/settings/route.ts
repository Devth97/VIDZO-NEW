import { adminRoute, body } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { z } from 'zod';

const input = z.object({ dailySpendCapInr: z.number().int().min(0).max(10_000_000), perUserConcurrency: z.number().int().min(1).max(5), generationPaused: z.boolean(), freeAnalysesPerDay: z.number().int().min(0).max(10), circuitBreakers: z.record(z.string().max(40), z.enum(['open', 'closed'])) });
export const POST = adminRoute(async (req, ctx) => {
  const value = input.parse(await body(req, 5000));
  await (await getDb()).query("update public.admin_settings set value = $1, updated_by = $2, updated_at = now() where key = 'limits'", [value, ctx.userId]);
  return { limits: value };
});
