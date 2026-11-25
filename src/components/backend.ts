import { createQuote, assertQuote, finalize, migrateV1Project, reserve, approveScene as approveLocal, setRoles } from '@/lib/domain/project';
import { ConflictError, mergeClientEdits } from '@/lib/domain/merge';
import { placeholderPricing, type Pricing } from '@/lib/domain/pricing';
import { placeholderSvg } from '@/lib/domain/placeholder';
import { localTestAnalysis, sampleProject } from '@/lib/domain/sample';
import { newProject } from '@/lib/domain/project';
import { projectSchema, type Asset, type JobView, type Project, type Quote, type QuoteScope, type Tier, type Wallet } from '@/lib/domain/schema';

export type Mode = 'demo' | 'local' | 'live';
export type Capabilities = { database: boolean; auth: boolean; storage: boolean; analysis: boolean; generation: boolean; payments: boolean; assembly: boolean; pricing: boolean };
export type Snapshot = { projects: Project[]; wallet: Wallet; role: 'demo' | 'member' | 'admin'; email?: string };
export type Payment = { id: string; packId: string; credits: number; amountPaise: number; currency: string; status: string; createdAt: string; capturedAt: string | null; simulated: boolean };
export type Order = { paymentId: string; orderId: string; amount: number; currency: string; credits: number; keyId?: string; simulated: boolean };

export class ApiError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }

export interface Backend {
  readonly kind: 'demo' | 'server';
  load(): Promise<Snapshot>;
  createProject(name: string, sample?: boolean): Promise<Project>;
  getProject(id: string): Promise<Project>;
  /** Saves the user's draft. Rejects with status 409 when `expectedRevision` is stale. */
  saveProject(p: Project, expectedRevision: number): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  upload(p: Project, file: File, kind: 'reference' | 'product' | 'logo'): Promise<Asset>;
  assetUrl(assetId: string, download?: boolean): Promise<string>;
  approve(p: Project, sceneId: string, frameAssetId: string): Promise<Project>;
  analyze(p: Project): Promise<{ id: string }>;
  quote(p: Project, tier: Tier, scope: QuoteScope, targetId?: string): Promise<Quote>;
  submit(quote: Quote, idempotencyKey: string): Promise<{ id: string; duplicate?: boolean }>;
  job(id: string): Promise<JobView>;
  retry(jobId: string): Promise<Quote>;
  wallet(): Promise<{ wallet: Wallet; payments: Payment[]; pricing: Pricing | null }>;
  order(packId: string): Promise<Order>;
  simulatePayment?(orderId: string, outcome: 'captured' | 'failed'): Promise<{ outcome: string }>;
  support(input: { subject: string; body: string; projectId?: string; jobId?: string }): Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------------------------
// Server backend (local test backend and live)
// ---------------------------------------------------------------------------------------------
async function call<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, method: rest.method ?? (json !== undefined ? 'POST' : 'GET'), headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: json !== undefined ? JSON.stringify(json) : undefined, credentials: 'same-origin' });
  } catch { throw new ApiError('You appear to be offline. Your changes will save when the connection returns.', 0, 'offline'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || 'The request could not be completed.', res.status, (data as { code?: string }).code);
  return data as T;
}

/** Reads a video's duration in the browser for early feedback. The server re-verifies the real bytes. */
export function readVideoSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video'); const u = URL.createObjectURL(file);
    const done = (fn: () => void) => { clearTimeout(timer); URL.revokeObjectURL(u); fn(); };
    const timer = setTimeout(() => done(() => reject(new Error('Could not read this video. Try a standard MP4.'))), 15_000);
    v.preload = 'metadata';
    v.onloadedmetadata = () => done(() => resolve(v.duration));
    v.onerror = () => done(() => reject(new Error('This video is corrupt or uses an unsupported codec.')));
    v.src = u;
  });
}

export const serverBackend: Backend = {
  kind: 'server',
  load: () => call('/api/workspace'),
  createProject: async name => (await call<{ project: Project }>('/api/projects', { json: { name } })).project,
  getProject: async id => (await call<{ project: Project }>('/api/projects/' + id)).project,
  saveProject: async (p, expectedRevision) => (await call<{ project: Project }>('/api/projects/' + p.id, { method: 'PUT', json: { project: p, expectedRevision } })).project,
  deleteProject: async id => { await call('/api/projects/' + id, { method: 'DELETE' }); },
  async upload(p, file, kind) {
    const { asset, upload } = await call<{ asset: Asset; upload: { url: string; headers: Record<string, string> } }>('/api/assets/sign', { json: { projectId: p.id, kind, name: file.name, mime: file.type, bytes: file.size } });
    let put: Response;
    try { put = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: file }); } catch { throw new ApiError('Upload interrupted. Check your connection and try again.', 0); }
    if (!put.ok) throw new ApiError('Upload failed. Please try again.', put.status);
    return (await call<{ asset: Asset }>(`/api/assets/${asset.id}/complete`, { method: 'POST', json: {} })).asset;
  },
  assetUrl: async (id, download) => (await call<{ url: string }>(`/api/assets/${id}${download ? '?download=1' : ''}`)).url,
  approve: async (p, sceneId, frameAssetId) => (await call<{ project: Project }>('/api/scenes/approve', { json: { projectId: p.id, sceneId, frameAssetId } })).project,
  analyze: p => call('/api/analysis', { json: { projectId: p.id } }),
  quote: (p, tier, scope, targetId) => call('/api/quotes', { json: { projectId: p.id, tier, scope, targetId } }),
  submit: (quote, idempotencyKey) => call('/api/jobs', { json: { quoteId: quote.id, idempotencyKey } }),
  job: id => call('/api/jobs/' + id),
  retry: id => call(`/api/jobs/${id}/retry`, { method: 'POST', json: {} }),
  wallet: () => call('/api/wallet'),
  order: packId => call('/api/payments/order', { json: { packId } }),
  simulatePayment: (orderId, outcome) => call('/api/dev/payments/simulate', { json: { orderId, outcome } }),
  support: input => call('/api/support', { json: input }),
};

// ---------------------------------------------------------------------------------------------
// Demo backend: everything stays in this browser. Same domain rules; providers and payments simulated.
// ---------------------------------------------------------------------------------------------
const KEY = 'vidzo-demo-v2', OLD_KEY = 'vidzo-demo-v1';
export const DEMO_START_CREDITS = 300;
type DemoState = { projects: Project[]; wallet: Wallet; jobs: Record<string, JobView & { quote: Quote }>; quotes: Record<string, Quote> };

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const r = indexedDB.open('vidzo-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('assets'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
async function putBlob(id: string, blob: Blob) {
  const db = await idb();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').put(blob, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error('Browser storage is full.')); }); } finally { db.close(); }
}
async function getBlob(id: string): Promise<Blob | undefined> {
  const db = await idb();
  try { return await new Promise((resolve, reject) => { const r = db.transaction('assets').objectStore('assets').get(id); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); } finally { db.close(); }
}

export function createDemoBackend(): Backend & { reviewExport(projectId: string): Promise<Project> } {
  let state: DemoState | null = null;
  const urls = new Map<string, string>();
  const read = (): DemoState => {
    if (state) return state;
    const fresh: DemoState = { projects: [], wallet: { available: DEMO_START_CREDITS, held: 0, spent: 0, operations: [] }, jobs: {}, quotes: {} };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as DemoState; state = { ...fresh, ...s, projects: s.projects.map(p => projectSchema.parse(p)) };
        // A demo job runs in this tab; one interrupted by closing the page is failed and its hold released.
        for (const j of Object.values(state.jobs)) if (['queued', 'submitted', 'running'].includes(j.status) && Date.now() - Date.parse(j.createdAt) > 30_000) {
          j.status = 'failed'; j.error = 'The demo simulation was interrupted when the page closed. Simulated credits were released.';
          if (j.creditsReserved) try { state.wallet = finalize(state.wallet, 'job:' + j.id, 0); } catch { /* already final */ }
        }
        return state;
      }
      const old = localStorage.getItem(OLD_KEY);
      if (old) { const o = JSON.parse(old) as { projects: Record<string, unknown>[]; wallet?: Wallet }; state = { ...fresh, wallet: o.wallet ?? fresh.wallet, projects: o.projects.flatMap(p => { try { return [projectSchema.parse(migrateV1Project(p))]; } catch { return []; } }) }; return state; }
    } catch { /* corrupt storage: start fresh rather than crash */ }
    state = fresh; return state;
  };
  const write = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { throw new ApiError('Browser storage is full. Download your brief, then remove old demo projects.', 507); }
  };
  const find = (id: string) => { const p = read().projects.find(x => x.id === id); if (!p) throw new ApiError('Project not found on this device.', 404); return p; };
  const put = (p: Project) => { const s = read(); s.projects = s.projects.some(x => x.id === p.id) ? s.projects.map(x => (x.id === p.id ? p : x)) : [p, ...s.projects]; write(); return p; };
  const bump = (p: Project) => put({ ...p, revision: p.revision + 1, updatedAt: new Date().toISOString() });
  const domainCall = <T,>(fn: () => T): T => { try { return fn(); } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError((e as Error).message, 422); } };
  const withStatus = (p: Project): Project => {
    const s = read();
    const job = Object.values(s.jobs).filter(j => j.projectId === p.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    if (job && ['queued', 'submitted', 'running'].includes(job.status)) return { ...p, status: job.kind === 'analysis' ? 'analyzing' : 'generating', activeJobId: job.id };
    return { ...p, activeJobId: undefined };
  };

  async function runDemoJob(id: string) {
    const s = read(); const job = s.jobs[id];
    await new Promise(r => setTimeout(r, 900));
    job.status = 'running'; job.stage = 'Simulating production (no provider is called)'; write();
    await new Promise(r => setTimeout(r, 1400));
    let p = find(job.projectId);
    const now = Date.now();
    const assets: Asset[] = [];
    for (const [i, t] of job.quote.tasks.entries()) {
      const id2 = crypto.randomUUID();
      const scene = p.scenes.find(x => x.id === t.sceneId), cand = p.candidates.find(c => c.id === t.candidateId);
      const kind = t.kind === 'export' ? 'export' : t.kind;
      let blob: Blob, mime: Asset['mime'];
      if (t.kind === 'export') { blob = new Blob([JSON.stringify({ disclosure: 'Demo assembly manifest. No MP4 was rendered and no AI video exists.', project: p.name, scenes: p.scenes.map(x => x.title), cta: p.brief.cta, target: '1080×1920 · 30 fps · H.264/AAC' }, null, 2)], { type: 'application/json' }); mime = 'application/json'; }
      else { blob = new Blob([placeholderSvg(t.kind === 'clip' ? 'clip' : t.kind === 'character' ? 'character' : 'frame', scene?.title ?? cand?.name ?? 'Demo', 1, p.brief.color)], { type: 'image/svg+xml' }); mime = 'image/svg+xml'; }
      await putBlob(id2, blob);
      const version = p.assets.filter(a => a.kind === kind && a.sceneId === t.sceneId && a.candidateId === t.candidateId).length + 1;
      assets.push({ id: id2, kind, name: `${kind}-demo-placeholder`, mime, bytes: blob.size, status: 'verified', placeholder: true, sceneId: t.sceneId, candidateId: t.candidateId, depHash: t.depHash, version, createdAt: new Date(now + i).toISOString() });
    }
    p = find(job.projectId);
    bump({ ...p, assets: [...p.assets, ...assets], status: job.kind === 'export' || job.kind === 'video' || job.kind === 'scene' ? 'review' : p.status, qa: job.kind === 'export' ? { exportAssetId: assets[0].id, decision: 'pending', at: new Date().toISOString() } : p.qa });
    if (job.quote.credits) s.wallet = finalize(s.wallet, 'job:' + id, job.quote.credits);
    job.status = job.kind === 'video' || job.kind === 'scene' || job.kind === 'export' ? 'review' : 'succeeded';
    job.stage = job.kind === 'export' ? 'Awaiting review (simulated)' : 'Complete (placeholder output)';
    job.creditsSettled = job.quote.credits; job.tasks = job.tasks.map(t => ({ ...t, status: 'succeeded' }));
    write();
  }

  return {
    kind: 'demo',
    async load() { const s = read(); return { projects: s.projects.map(withStatus), wallet: s.wallet, role: 'demo' }; },
    async createProject(name, sample) { return put(sample ? sampleProject() : newProject(name)); },
    async getProject(id) { return withStatus(find(id)); },
    async saveProject(p, expectedRevision) {
      const stored = find(p.id);
      if (stored.revision !== expectedRevision) throw new ApiError(new ConflictError().message, 409, 'conflict');
      return withStatus(bump(domainCall(() => mergeClientEdits(stored, p, { requireSheets: true }))));
    },
    async deleteProject(id) { const s = read(); s.projects = s.projects.filter(p => p.id !== id); write(); },
    async upload(p, file, kind) {
      let seconds: number | undefined;
      if (kind === 'reference') seconds = await readVideoSeconds(file);
      const asset: Asset = { id: crypto.randomUUID(), kind, name: file.name.slice(0, 200), mime: file.type as Asset['mime'], bytes: file.size, seconds, status: 'verified', placeholder: false, createdAt: new Date().toISOString() };
      await putBlob(asset.id, file);
      const stored = find(p.id);
      bump({ ...stored, assets: [...stored.assets, asset] });
      return asset;
    },
    async assetUrl(id) {
      const cached = urls.get(id); if (cached) return cached;
      const blob = await getBlob(id);
      if (!blob) throw new ApiError('This file is no longer in browser storage. Upload it again.', 404);
      const url = URL.createObjectURL(blob); urls.set(id, url); return url;
    },
    async approve(p, sceneId, frameAssetId) { return withStatus(bump(domainCall(() => approveLocal(find(p.id), sceneId, frameAssetId)))); },
    async analyze(p) {
      const stored = find(p.id);
      const ref = stored.assets.find(a => a.kind === 'reference');
      if (!ref?.seconds) throw new ApiError('Upload a reference first.', 422);
      const base = localTestAnalysis(Math.round(ref.seconds * 1000));
      const analysis = { ...base, source: 'sample' as const, summary: 'Illustrative analysis for explore mode. No AI model watched your video; describe the concept yourself.', risks: ['Explore mode cannot analyse uploaded video. Timestamps are evenly spaced across your video, not detected cuts.'] };
      bump({ ...setRoles({ ...stored, analysis: { ...analysis, roles: [] } }, []), step: Math.max(stored.step, 1) });
      return { id: 'demo-analysis' };
    },
    async quote(p, tier, scope, targetId) {
      const q = domainCall(() => createQuote(find(p.id), tier, scope, targetId, placeholderPricing));
      read().quotes[q.id] = q; write(); return q;
    },
    async submit(quote, key) {
      const s = read();
      const dup = Object.values(s.jobs).find(j => j.quote.id === quote.id);
      if (dup) return { id: dup.id, duplicate: true };
      const p = find(quote.projectId);
      if (withStatus(p).activeJobId) throw new ApiError('This project already has a job running.', 409);
      domainCall(() => assertQuote(p, quote, placeholderPricing));
      const id = crypto.randomUUID();
      if (quote.credits) s.wallet = domainCall(() => reserve(s.wallet, quote.credits, 'job:' + id));
      const now = new Date().toISOString();
      s.jobs[id] = { id, projectId: p.id, kind: quote.scope, status: 'queued', stage: 'Queued (simulated)', creditsReserved: quote.credits, creditsSettled: 0, createdAt: now, updatedAt: now, tasks: quote.tasks.map(t => ({ taskId: t.taskId, kind: t.kind, sceneId: t.sceneId, status: 'pending' })), quote };
      write();
      void runDemoJob(id).catch(() => { const j = read().jobs[id]; j.status = 'failed'; j.error = 'Demo storage failed. Unsettled credits were released.'; read().wallet = finalize(read().wallet, 'job:' + id, 0); write(); });
      void key;
      return { id };
    },
    async job(id) { const j = read().jobs[id]; if (!j) throw new ApiError('Job not found.', 404); const { quote: _q, ...view } = j; return view; },
    async retry(id) { const j = read().jobs[id]; return this.quote(find(j.projectId), j.quote.tier, j.quote.scope, j.quote.targetId); },
    async wallet() { return { wallet: read().wallet, payments: [], pricing: placeholderPricing }; },
    async order() { throw new ApiError('Explore mode cannot take payments. Set up an account to buy credits.', 400); },
    async support() { throw new ApiError('Support requests need an account. Email support once the beta opens.', 400); },
    async reviewExport(projectId) {
      const p = find(projectId);
      if (!p.qa) throw new ApiError('No export to review.', 400);
      return withStatus(bump({ ...p, status: 'ready', qa: { ...p.qa, decision: 'approved', note: 'Simulated reviewer approval in explore mode.', at: new Date().toISOString() } }));
    },
  };
}

