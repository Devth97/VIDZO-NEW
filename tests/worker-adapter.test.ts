import { describe, expect, it } from 'vitest';
import { workerProvider } from '@/lib/server/providers/worker';
import { ProviderError, type ProviderTask } from '@/lib/server/providers/types';

const task: ProviderTask = { taskId: 'export', kind: 'export', tier: 'professional', prompt: '', label: 'Launch', inputAssetIds: ['a', 'b'], overlay: { brand: 'Acme', cta: 'Shop now', font: '', color: '#c8f169', logoAssetId: 'logo' } };
const cfg = { url: 'https://media.example.test/', token: 'secret-token' };

function fakeWorker(routes: Record<string, (init?: RequestInit) => Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = Object.keys(routes).find(r => url.endsWith(r));
    return route ? routes[route](init) : new Response('{"error":"Not found."}', { status: 404 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('media worker adapter', () => {
  it('submits the exact assembly contract with the job idempotency key', async () => {
    const { calls, fetchImpl } = fakeWorker({ '/jobs': () => json({ id: 'w1', state: 'queued' }, 202) });
    const { requestId } = await workerProvider(cfg, fetchImpl).submit(task, { urls: { a: 'https://r2/a', b: 'https://r2/b', logo: 'https://r2/logo' } }, 'job-1:export');
    expect(requestId).toBe('w1');
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toEqual({ idempotencyKey: 'job-1:export', clips: ['https://r2/a', 'https://r2/b'], logo: 'https://r2/logo', overlay: task.overlay, target: { width: 1080, height: 1920, fps: 30 } });
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });

  it('refuses to submit when a clip URL is missing, and maps an unanswered submission to unknown', async () => {
    const p = workerProvider(cfg, fakeWorker({}).fetchImpl);
    await expect(p.submit(task, { urls: { a: 'https://r2/a' } }, 'job-1:export')).rejects.toMatchObject({ kind: 'permanent' });
    const timeout = workerProvider(cfg, (async () => { throw new DOMException('timed out', 'TimeoutError'); }) as typeof fetch);
    await expect(timeout.submit(task, { urls: { a: 'x', b: 'y' } }, 'job-1:export')).rejects.toBeInstanceOf(ProviderError);
  });

  it('passes the worker’s customer-safe failure reason and keeps the technical report with the file', async () => {
    const report = { output: { width: 1080, height: 1920, fps: '30/1' }, upscaled: true };
    const { fetchImpl } = fakeWorker({
      '/jobs/w2': () => json({ id: 'w2', state: 'failed', error: 'Every clip must be an MP4 or MOV file.' }),
      '/jobs/w3': () => json({ id: 'w3', state: 'completed', report }),
      '/jobs/w3/result': () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    });
    const p = workerProvider(cfg, fetchImpl);
    expect(await p.status('w2', task)).toEqual({ state: 'failed', error: 'Every clip must be an MP4 or MOV file.' });
    const file = await p.result('w3', task);
    expect([...file.bytes]).toEqual([1, 2, 3]);
    expect(file.meta).toEqual({ assembly: report });
  });

  it('reconciles by idempotency key and returns null when the worker never saw the request', async () => {
    const { fetchImpl } = fakeWorker({ '/jobs?idempotencyKey=job-1%3Aexport': () => json({ id: 'w1', state: 'running' }) });
    const p = workerProvider(cfg, fetchImpl);
    expect(await p.reconcile('job-1:export', task)).toBe('w1');
    expect(await p.reconcile('job-2:export', task)).toBeNull();
  });
});
