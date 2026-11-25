import { placeholderSvg } from '@/lib/domain/placeholder';
import { ProviderError, type ProviderAdapter, type ProviderTask } from './types';

/**
 * LOCAL TEST BACKEND ONLY. Exercises the real orchestration (queue → status → result → storage → ledger)
 * while producing clearly labelled placeholder files. It never contacts a provider and is never used in live mode.
 * Request ids encode their submit time so status survives a dev-server restart.
 */
export function simulatedProvider(opts: { delayMs?: number; failKinds?: ProviderTask['kind'][]; submitErrors?: ProviderError[] } = {}): ProviderAdapter & { submissions: Map<string, string> } {
  const delay = opts.delayMs ?? 1500;
  const submissions = new Map<string, string>();
  const errors = [...(opts.submitErrors ?? [])];
  return {
    name: 'simulated', submissions,
    endpoint: task => `simulated/${task.kind}`,
    async submit(task, _inputs, key) {
      const e = errors.shift();
      if (e) { if (e.kind === 'unknown') submissions.set(key, `sim_${Date.now()}_${task.taskId}`); throw e; }
      const requestId = `sim_${Date.now()}_${task.taskId}`;
      submissions.set(key, requestId);
      return { requestId };
    },
    async status(requestId, task) {
      const ts = Number(requestId.split('_')[1]);
      if (!Number.isFinite(ts)) return { state: 'failed', error: 'Unknown simulated request.' };
      if (Date.now() - ts < delay) return { state: Date.now() - ts < delay / 3 ? 'queued' : 'running' };
      if (opts.failKinds?.includes(task.kind)) return { state: 'failed', error: 'Simulated provider failure (test).' };
      return { state: 'completed' };
    },
    async result(_requestId, task) {
      if (task.kind === 'export') {
        const manifest = {
          disclosure: 'Assembly manifest from the local test backend. No MP4 was rendered and no AI video exists.',
          target: { width: 1080, height: 1920, fps: 30, video: 'H.264', audio: 'AAC (licensed track or silence; reference audio excluded)' },
          clips: task.inputAssetIds, overlay: task.overlay, createdAt: new Date().toISOString(),
        };
        return { bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)), mime: 'application/json', placeholder: true, name: 'assembly-manifest.json' };
      }
      const kind = task.kind === 'clip' ? 'clip' : task.kind === 'character' ? 'character' : 'frame';
      return { bytes: new TextEncoder().encode(placeholderSvg(kind, task.label, 1, task.overlay?.color)), mime: 'image/svg+xml', placeholder: true, name: `${kind}-placeholder.svg` };
    },
    async reconcile(key) { return submissions.get(key) ?? null; },
  };
}
