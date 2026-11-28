// Cloudflare Worker entry: vinext serves every request; the cron trigger in cloudflare.config.ts runs the
// background job sweep so generation keeps progressing when no browser is open.
import app from 'vinext/server/fetch-handler';
import { sweepJobs } from '@/lib/server/jobs';

export * from 'vinext/server/fetch-handler';

export default {
  ...app,
  scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(sweepJobs().then(
      beat => { if (beat.due || beat.errors) console.log('[vidzo] sweep', JSON.stringify(beat)); },
      e => console.error('[vidzo] sweep failed', e instanceof Error ? e.message.slice(0, 200) : e),
    ));
  },
};
