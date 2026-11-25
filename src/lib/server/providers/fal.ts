import { normalizeError, ProviderError, type ProviderAdapter, type ProviderTask } from './types';

/**
 * fal queue API adapter (https://fal.ai/docs/model-apis/model-endpoints/queue).
 * NOT VERIFIED against a live account. Endpoint ids come from configuration after the benchmark; the input
 * mapping below is a generic image-to-video/image shape and MUST be checked against the chosen endpoint's
 * published schema before enabling paid generation.
 */
export type FalConfig = { key: string; image: string; professional: string; premium: string; resultHosts: string[] };
type Fetch = typeof fetch;

const MAX_RESULT_BYTES = 100_000_000;

export function falProvider(cfg: FalConfig, fetchImpl: Fetch = fetch): ProviderAdapter {
  const endpoint = (t: ProviderTask) => (t.kind === 'clip' ? cfg[t.tier] : cfg.image);
  const base = (t: ProviderTask) => `https://queue.fal.run/${endpoint(t)}`;
  const headers = { Authorization: `Key ${cfg.key}`, 'Content-Type': 'application/json' };
  async function call(url: string, init: RequestInit, sent: boolean) {
    let res: Response;
    try { res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(30_000) }); } catch (e) { throw normalizeError(e, sent); }
    if (!res.ok) throw normalizeError({ status: res.status }, sent);
    return res.json() as Promise<Record<string, unknown>>;
  }
  return {
    name: 'fal',
    endpoint,
    async submit(task, inputs) {
      const images = task.inputAssetIds.map(id => inputs.urls[id]).filter(Boolean);
      const body = task.kind === 'clip'
        ? { prompt: task.prompt, image_url: images[0], duration: String(task.seconds ?? 5), aspect_ratio: '9:16' }
        : { prompt: task.prompt, image_urls: images, aspect_ratio: task.kind === 'character' ? '1:1' : '9:16', num_images: 1 };
      const json = await call(base(task), { method: 'POST', headers, body: JSON.stringify(body) }, true);
      if (typeof json.request_id !== 'string') throw new ProviderError('unknown', 'The provider did not return a request id.');
      return { requestId: json.request_id };
    },
    async status(requestId, task) {
      const json = await call(`${base(task)}/requests/${encodeURIComponent(requestId)}/status`, { headers }, false);
      const s = String(json.status);
      if (s === 'COMPLETED') return json.error ? { state: 'failed', error: 'The provider reported a failed generation.' } : { state: 'completed' };
      if (s === 'IN_PROGRESS') return { state: 'running' };
      if (s === 'IN_QUEUE') return { state: 'queued' };
      return { state: 'failed', error: 'Unexpected provider status.' };
    },
    async result(requestId, task) {
      const json = await call(`${base(task)}/requests/${encodeURIComponent(requestId)}`, { headers }, false);
      const url = task.kind === 'clip' ? (json.video as { url?: string } | undefined)?.url : (json.images as { url?: string }[] | undefined)?.[0]?.url ?? (json.image as { url?: string } | undefined)?.url;
      if (!url) throw new ProviderError('permanent', 'The provider result did not include a file.');
      const bytes = await downloadAllowed(url, cfg.resultHosts, fetchImpl);
      return { bytes, mime: task.kind === 'clip' ? 'video/mp4' : 'image/png', placeholder: false, name: `${task.kind}.${task.kind === 'clip' ? 'mp4' : 'png'}` };
    },
    async reconcile() { return null; }, // fal has no lookup by client key; unknown submissions go to manual review.
    async cancel(requestId, task) { await call(`${base(task)}/requests/${encodeURIComponent(requestId)}/cancel`, { method: 'PUT', headers }, false).catch(() => undefined); },
  };
}

/** SSRF guard: https only, exact allowlisted hosts, no redirects, bounded size. The true mime is re-verified on store. */
export async function downloadAllowed(raw: string, hosts: string[], fetchImpl: Fetch = fetch, reqHeaders?: Record<string, string>): Promise<Uint8Array> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ProviderError('permanent', 'Invalid result URL.'); }
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || (url.port && url.port !== '443')) throw new ProviderError('permanent', 'Result host is not allowed.');
  let res: Response;
  try { res = await fetchImpl(url, { headers: reqHeaders, redirect: "error", signal: AbortSignal.timeout(120_000) }); } catch (e) { throw normalizeError(e, false); }
  if (!res.ok || !res.body) throw normalizeError({ status: res.status }, false);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_RESULT_BYTES) throw new ProviderError('permanent', 'Result file is too large.');
  const reader = res.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_RESULT_BYTES) { await reader.cancel(); throw new ProviderError('permanent', 'Result file is too large.'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
