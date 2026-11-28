import { downloadAllowed } from './fal';
import { normalizeError, ProviderError, type ProviderAdapter } from './types';

/**
 * Media worker adapter (services/media-worker). NOT VERIFIED end to end: requires a deployed worker.
 * The worker fetches signed clip/logo URLs from our storage host only, assembles 1080×1920 / 30 fps
 * H.264/AAC with exact logo + CTA overlays and without reference audio, then serves the MP4 for retrieval.
 */
export function workerProvider(cfg: { url: string; token: string }, fetchImpl: typeof fetch = fetch): ProviderAdapter {
  const base = cfg.url.replace(/\/$/, '');
  const host = new URL(base).hostname;
  const headers = { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' };
  async function call(path: string, init: RequestInit, sent: boolean) {
    let res: Response;
    try { res = await fetchImpl(base + path, { ...init, signal: AbortSignal.timeout(30_000) }); } catch (e) { throw normalizeError(e, sent); }
    if (!res.ok) throw normalizeError({ status: res.status }, sent);
    return res.json() as Promise<Record<string, unknown>>;
  }
  return {
    name: 'media-worker',
    endpoint: () => 'assemble',
    async submit(task, inputs, key) {
      if (task.kind !== 'export') throw new ProviderError('permanent', 'The media worker only assembles exports.');
      const clips = task.inputAssetIds.map(id => inputs.urls[id]);
      if (clips.some(c => !c)) throw new ProviderError('permanent', 'A clip input is missing.');
      const logo = task.overlay?.logoAssetId ? inputs.urls[task.overlay.logoAssetId] : undefined;
      const json = await call('/jobs', { method: 'POST', headers, body: JSON.stringify({ idempotencyKey: key, clips, logo, overlay: task.overlay, target: { width: 1080, height: 1920, fps: 30 } }) }, true);
      if (typeof json.id !== 'string') throw new ProviderError('unknown', 'The worker did not return a job id.');
      return { requestId: json.id };
    },
    async status(id) {
      const json = await call(`/jobs/${encodeURIComponent(id)}`, { headers }, false);
      const s = String(json.state);
      // Worker error messages are written for customers and never contain paths, URLs or tool output.
      const error = typeof json.error === 'string' ? json.error.slice(0, 300) : 'Assembly failed in the media worker.';
      return s === 'completed' ? { state: 'completed' } : s === 'failed' ? { state: 'failed', error } : { state: s === 'running' ? 'running' : 'queued' };
    },
    async result(id) {
      // The technical report (output checks, upscaling, encoder settings) is kept with the export for QA and support.
      const view = await call(`/jobs/${encodeURIComponent(id)}`, { headers }, false);
      const bytes = await downloadAllowed(`${base}/jobs/${encodeURIComponent(id)}/result`, [host], fetchImpl, { Authorization: `Bearer ${cfg.token}` });
      return { bytes, mime: 'video/mp4', placeholder: false, name: 'export.mp4', meta: view.report && typeof view.report === 'object' ? { assembly: view.report } : undefined };
    },
    async reconcile(key) {
      const json = await call(`/jobs?idempotencyKey=${encodeURIComponent(key)}`, { headers }, false).catch(() => null);
      return json && typeof json.id === 'string' ? json.id : null;
    },
  };
}
