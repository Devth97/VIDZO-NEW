import { downloadAllowed } from './fal';
import { normalizeError, ProviderError, type ProviderAdapter, type ProviderInputs, type ProviderTask } from './types';

/**
 * Media worker adapter (services/media-worker). NOT VERIFIED end to end: requires a deployed worker.
 * Async mode (POST /jobs, poll, fetch result) suits always-on containers; sync mode (POST /render) suits
 * hosts that only give CPU during a request.
 * The worker fetches signed clip/logo URLs from our storage host only, assembles 1080×1920 / 30 fps
 * H.264/AAC with exact logo + CTA overlays and without reference audio, then serves the MP4 for retrieval.
 */
function assembleBody(task: ProviderTask, inputs: ProviderInputs, key: string) {
  if (task.kind !== 'export') throw new ProviderError('permanent', 'The media worker only assembles exports.');
  const clips = task.inputAssetIds.map(id => inputs.urls[id]);
  if (clips.some(c => !c)) throw new ProviderError('permanent', 'A clip input is missing.');
  const logo = task.overlay?.logoAssetId ? inputs.urls[task.overlay.logoAssetId] : undefined;
  return { idempotencyKey: key, clips, logo, overlay: task.overlay, target: { width: 1080, height: 1920, fps: 30 } };
}

const MAX_RESULT_BYTES = 150_000_000;
const RENDER_TIMEOUT_MS = 14 * 60_000; // inside the 15-minute cron limit

export function workerProvider(cfg: { url: string; token: string; sync?: boolean }, fetchImpl: typeof fetch = fetch): ProviderAdapter {
  const base = cfg.url.replace(/\/$/, '');
  const host = new URL(base).hostname;
  const headers = { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' };
  async function call(path: string, init: RequestInit, sent: boolean) {
    let res: Response;
    try { res = await fetchImpl(base + path, { ...init, signal: AbortSignal.timeout(30_000) }); } catch (e) { throw normalizeError(e, sent); }
    if (!res.ok) throw normalizeError({ status: res.status }, sent);
    return res.json() as Promise<Record<string, unknown>>;
  }
  /** Renders inside one request and returns the MP4; the technical report travels in a header. */
  async function run(task: ProviderTask, inputs: ProviderInputs, key: string) {
    const body = assembleBody(task, inputs, key);
    let res: Response;
    try { res = await fetchImpl(base + '/render', { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(RENDER_TIMEOUT_MS) }); } catch (e) { throw normalizeError(e, false); }
    if (res.status === 422) {
      // Customer-safe reason (bad input, failed technical checks): redoing it will not help.
      const json = await res.json().catch(() => ({})) as { error?: unknown };
      throw new ProviderError('permanent', typeof json.error === 'string' ? json.error.slice(0, 300) : 'Assembly failed in the media worker.');
    }
    if (!res.ok || !res.body) throw normalizeError({ status: res.status }, false);
    if (Number(res.headers.get('content-length') ?? 0) > MAX_RESULT_BYTES) throw new ProviderError('permanent', 'The rendered file is too large.');
    const reader = res.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_RESULT_BYTES) { await reader.cancel(); throw new ProviderError('permanent', 'The rendered file is too large.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; }
    let report: unknown;
    try { report = JSON.parse(atob(res.headers.get('x-vidzo-report') ?? '')); } catch { report = undefined; }
    return { bytes, mime: 'video/mp4', placeholder: false, name: 'export.mp4', meta: report && typeof report === 'object' ? { assembly: report as Record<string, unknown> } : undefined };
  }
  return {
    name: 'media-worker',
    ...(cfg.sync ? { run } : {}),
    endpoint: () => 'assemble',
    async submit(task, inputs, key) {
      const json = await call('/jobs', { method: 'POST', headers, body: JSON.stringify(assembleBody(task, inputs, key)) }, true);
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
