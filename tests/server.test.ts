// Integration tests for the server layer against real Postgres semantics (PGlite, in memory) running the same
// SQL migration used for Supabase. PGlite is a single connection, so "concurrent" calls are interleaved
// transactions rather than parallel backends; true multi-connection contention still needs a real Postgres run.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.VIDZO_MODE = 'local';
process.env.VIDZO_POLL_MS = '0';

const { createPgliteDb, setTestDb } = await import('@/lib/server/db');
const { createPgTestDb } = await import('./support/pg');
const pgUrl = process.env.VIDZO_TEST_PG_URL; // set in CI: the same suite then runs on real PostgreSQL
const { memoryStorage, setTestStorage, objectKey } = await import('@/lib/server/storage');
const { setTestProviders } = await import('@/lib/server/providers');
const { simulatedProvider } = await import('@/lib/server/providers/simulated');
const { ProviderError } = await import('@/lib/server/providers/types');
const { ensureWorkspace } = await import('@/lib/server/auth');
const repo = await import('@/lib/server/repo');
const assets = await import('@/lib/server/assets');
const jobs = await import('@/lib/server/jobs');
const payments = await import('@/lib/server/payments');
const { currentFrame, sceneDepHash } = await import('@/lib/domain/project');

type Db = Awaited<ReturnType<typeof createPgliteDb>>;
type Ctx = Awaited<ReturnType<typeof ensureWorkspace>>;
let db: Db; const storage = memoryStorage();

async function user(email: string): Promise<Ctx> {
  const [u] = await db.query<{ id: string; email: string }>('insert into auth.users(email) values ($1) returning id, email', [email]);
  return db.tx(q => ensureWorkspace(q, u));
}
async function credit(ctx: Ctx, packId = 'studio') {
  const order = await payments.createOrder(db, ctx, packId);
  await payments.simulateWebhook(ctx, order.orderId, 'captured');
  return order;
}
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function box(type: string, ...children: Uint8Array[]) {
  const body = children.reduce((n, c) => n + c.length, 0); const out = new Uint8Array(8 + body);
  new DataView(out.buffer).setUint32(0, 8 + body); out.set([...type].map(c => c.charCodeAt(0)), 4);
  let o = 8; for (const c of children) { out.set(c, o); o += c.length; } return out;
}
const b = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap(p => (typeof p === 'string' ? [...p].map(c => c.charCodeAt(0)) : p)));
function mp4(seconds = 10) {
  const trak = box('trak', box('mdia', box('hdlr', b([0, 0, 0, 0], be32(0), 'vide', new Array(13).fill(0))), box('minf', box('stbl', box('stsd', b([0, 0, 0, 0], be32(1), be32(16), 'avc1', new Array(8).fill(0)))))));
  const parts = [box('ftyp', b('isom', be32(0), 'isom')), box('moov', box('mvhd', b([0, 0, 0, 0], be32(0), be32(0), be32(1000), be32(seconds * 1000), new Array(80).fill(0))), trak), box('mdat', new Uint8Array(32))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
const png = () => b([0x89], 'PNG', [13, 10, 26, 10], be32(13), 'IHDR', be32(800), be32(800), [8, 6, 0, 0, 0], new Array(20).fill(0));

async function upload(ctx: Ctx, projectId: string, kind: 'reference' | 'product' | 'logo', bytes: Uint8Array, mime: string) {
  const { asset } = await assets.signUpload(db, ctx, { projectId, kind, name: kind + '.bin', mime, bytes: bytes.length });
  await storage.write(objectKey(ctx.workspaceId, projectId, asset.id), bytes, mime); // stands in for the browser PUT
  return assets.completeUpload(db, ctx, asset.id);
}
async function settle(jobId: string) {
  for (let i = 0; i < 40; i++) {
    await jobs.advanceJob(jobId);
    const [j] = await db.query<{ status: string; needs_attention: boolean }>('select status, needs_attention from public.jobs where id = $1', [jobId]);
    if (!['queued', 'submitted', 'running'].includes(j.status)) return j.status;
  }
  return 'timeout';
}
async function readyProject(ctx: Ctx) {
  let p = await repo.createProject(db, ctx, 'Launch');
  p = await repo.saveProject(db, ctx, p.id, { ...p, rights: true }, p.revision);
  await upload(ctx, p.id, 'reference', mp4(12), 'video/mp4');
  await upload(ctx, p.id, 'product', png(), 'image/png');
  await upload(ctx, p.id, 'logo', png(), 'image/png');
  const a = await jobs.startAnalysis(ctx, p.id);
  expect(await settle(a.id)).toBe('succeeded');
  p = await repo.loadProject(db, ctx, p.id);
  expect(p.analysis?.source).toBe('local-test');
  expect(p.analysis?.shots.at(-1)?.endMs).toBe(12_000);
  p = await repo.saveProject(db, ctx, p.id, { ...p, brief: { ...p.brief, brand: 'Acme', product: 'Bottle', differences: 'All new', cta: 'Shop' }, step: 4 }, p.revision);
  expect(p.step).toBe(4);
  return p;
}

beforeAll(async () => { db = pgUrl ? await createPgTestDb(pgUrl) : await createPgliteDb(); setTestDb(db); setTestStorage(storage); await db.query(`update public.admin_settings set value = jsonb_set(value, '{dailySpendCapInr}', '1000000') where key = 'limits'`); });
afterAll(async () => { setTestDb(undefined); setTestStorage(undefined); await db.close?.(); });
beforeEach(() => setTestProviders({ generation: simulatedProvider({ delayMs: 0 }), assembly: simulatedProvider({ delayMs: 0 }) }));

describe('credit ledger (SQL functions)', () => {
  it('starts new workspaces at zero and credits only verified captures, once', async () => {
    const ctx = await user('ledger@example.test');
    expect((await repo.loadWallet(db, ctx.workspaceId)).available).toBe(0);
    const order = await payments.createOrder(db, ctx, 'starter');
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: order.orderId, amount: order.amount, currency: 'INR', status: 'captured' } } } });
    await expect(payments.handleRazorpayWebhook(body, 'f'.repeat(64), 'evt_1')).rejects.toThrow(/signature/i);
    const sig = payments.signWebhook(body, payments.localWebhookSecret());
    expect((await payments.handleRazorpayWebhook(body, sig, 'evt_1')).outcome).toBe('captured');
    expect((await payments.handleRazorpayWebhook(body, sig, 'evt_1')).outcome).toBe('duplicate_event');
    expect((await payments.handleRazorpayWebhook(body, sig, 'evt_2')).outcome).toBe('duplicate');
    const failed = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_1', order_id: order.orderId, amount: order.amount, currency: 'INR', status: 'failed' } } } });
    await payments.handleRazorpayWebhook(failed, payments.signWebhook(failed, payments.localWebhookSecret()), 'evt_3');
    const w = await repo.loadWallet(db, ctx.workspaceId);
    expect(w.available).toBe(100);
    expect(w.operations.filter(o => o.kind === 'purchase')).toHaveLength(1);
  });
  it('rejects a capture whose amount does not match the order', async () => {
    const ctx = await user('mismatch@example.test');
    const order = await payments.createOrder(db, ctx, 'starter');
    expect((await payments.simulateWebhook(ctx, order.orderId, 'captured', true)).outcome).toBe('mismatch');
    expect((await repo.loadWallet(db, ctx.workspaceId)).available).toBe(0);
  });
  it('never oversells under interleaved reservations and keeps the ledger append-only', async () => {
    const ctx = await user('race@example.test');
    await credit(ctx, 'studio'); // 250
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => db.tx(q => repo.reserveCredits(q, ctx.workspaceId, 'op' + i, 60, crypto.randomUUID()))));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(4);
    const w = await repo.loadWallet(db, ctx.workspaceId);
    expect(w).toMatchObject({ available: 10, held: 240 });
    await db.tx(q => repo.finalizeCredits(q, ctx.workspaceId, 'op0', 20));
    await db.tx(q => repo.finalizeCredits(q, ctx.workspaceId, 'op0', 20));
    await expect(db.tx(q => repo.finalizeCredits(q, ctx.workspaceId, 'op0', 60))).rejects.toMatchObject({ code: "operation_conflict" });
    expect(await repo.loadWallet(db, ctx.workspaceId)).toMatchObject({ available: 50, held: 180, spent: 20 });
    await expect(db.query("update public.ledger_entries set amount = 1 where operation_id = 'op0'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from public.ledger_entries where operation_id = 'op0'")).rejects.toThrow(/append-only/);
    await expect(db.query('update public.wallets set available = -1 where workspace_id = $1', [ctx.workspaceId])).rejects.toThrow();
  });
});

describe('tenant isolation (RLS)', () => {
  it('reports database readiness without exposing connection details', async () => {
    const { GET } = await import('@/app/api/health/route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok', runnerAgeSeconds: null }); // no sweep has run yet
  });

  it('fails readiness without exposing a database error or credential', async () => {
    const { GET } = await import('@/app/api/health/route');
    setTestDb({ ...db, query: async () => { throw new Error('private database connection detail'); } });
    try {
      const response = await GET();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: 'unavailable' });
    } finally { setTestDb(db); }
  });

  it('blocks both API roles from every credit mutation under hosted Supabase defaults', async () => {
    const functions = await db.query<{ name: string; anonymous: boolean; signed_in: boolean }>(`
      select p.proname as name,
        has_function_privilege('anon', p.oid, 'execute') as anonymous,
        has_function_privilege('authenticated', p.oid, 'execute') as signed_in
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('wallet_reserve', 'wallet_finalize', 'payment_capture')
    `);
    expect(functions).toHaveLength(3);
    for (const fn of functions) expect(fn, fn.name).toMatchObject({ anonymous: false, signed_in: false });
    const [membership] = await db.query<{ anonymous: boolean; signed_in: boolean }>(`
      select has_function_privilege('anon', 'public.is_member(uuid)', 'execute') as anonymous,
        has_function_privilege('authenticated', 'public.is_member(uuid)', 'execute') as signed_in
    `);
    expect(membership).toEqual({ anonymous: false, signed_in: true });
  });

  it('members read only their own workspace rows and cannot write directly', async () => {
    const a = await user('a@example.test'), b2 = await user('b@example.test');
    const pa = await repo.createProject(db, a, 'A'), pb = await repo.createProject(db, b2, 'B');
    const asRole = async (uid: string, sql: string) => db.tx(async q => { await q.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]); await q.query('set local role authenticated'); return q.query<{ id: string }>(sql); });
    const seen = (await asRole(a.userId, 'select id from public.projects')).map(r => r.id);
    expect(seen).toContain(pa.id); expect(seen).not.toContain(pb.id);
    expect(await asRole(a.userId, 'select * from public.wallets')).toHaveLength(1);
    expect(await asRole(a.userId, 'select * from public.attempts')).toHaveLength(0);
    await expect(asRole(a.userId, `update public.wallets set available = 999999`)).rejects.toThrow();
    await expect(asRole(a.userId, `select public.wallet_reserve('${a.workspaceId}', 'x', 1, null)`)).rejects.toThrow();
    // application-level checks: another workspace's project is simply not found
    await expect(repo.loadProject(db, a, pb.id)).rejects.toThrow(/not found/i);
  });
});

describe('projects and uploads', () => {
  it('uses optimistic concurrency and ignores forged server facts', async () => {
    const ctx = await user('save@example.test');
    const p = await repo.createProject(db, ctx, 'Draft');
    const saved = await repo.saveProject(db, ctx, p.id, { ...p, name: 'Renamed', status: 'ready', sample: true }, p.revision);
    expect(saved).toMatchObject({ name: 'Renamed', status: 'draft', sample: false, revision: p.revision + 1 });
    await expect(repo.saveProject(db, ctx, p.id, { ...p, name: 'Stale' }, p.revision)).rejects.toMatchObject({ status: 409 });
  });
  it('verifies real bytes and rejects disguised or mismatched uploads without charge', async () => {
    const ctx = await user('upload@example.test');
    let p = await repo.createProject(db, ctx, 'Uploads');
    await expect(assets.signUpload(db, ctx, { projectId: p.id, kind: 'reference', name: 'r.mp4', mime: 'video/mp4', bytes: 100 })).rejects.toThrow(/rights/);
    p = await repo.saveProject(db, ctx, p.id, { ...p, rights: true }, p.revision);
    expect((await upload(ctx, p.id, 'reference', mp4(10), 'video/mp4')).status).toBe('verified');
    expect((await upload(ctx, p.id, 'reference', mp4(40), 'video/mp4')).rejectReason).toMatch(/5–30/);
    expect((await upload(ctx, p.id, 'product', new TextEncoder().encode('<script>alert(1)</script>'.repeat(4)), 'image/png')).status).toBe('rejected');
    const { asset } = await assets.signUpload(db, ctx, { projectId: p.id, kind: 'logo', name: 'l.png', mime: 'image/png', bytes: 999 });
    await storage.write(objectKey(ctx.workspaceId, p.id, asset.id), png(), 'image/png');
    expect((await assets.completeUpload(db, ctx, asset.id)).rejectReason).toMatch(/size/);
    await expect(assets.signUpload(db, ctx, { projectId: p.id, kind: 'product', name: 'big.png', mime: 'image/png', bytes: 10_000_001 })).rejects.toThrow(/10 MB/);
    expect((await repo.loadWallet(db, ctx.workspaceId)).spent).toBe(0);
    await expect(db.query("update public.assets set bytes = 1 where status = 'verified'")).rejects.toThrow(/immutable/);
  });
});

describe('generation orchestration', () => {
  it('runs frames → approvals → clips → export with holds, settlement and dependency-aware quotes', async () => {
    const ctx = await user('flow@example.test');
    await credit(ctx, 'studio');
    let p = await readyProject(ctx);
    const fq = await jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'frame' });
    expect(fq.tasks).toHaveLength(3); expect(fq.credits).toBe(15);
    const fj = await jobs.createJob(ctx, { quoteId: fq.id, idempotencyKey: fq.id });
    expect((await jobs.createJob(ctx, { quoteId: fq.id, idempotencyKey: fq.id })).duplicate).toBe(true);
    expect((await repo.loadWallet(db, ctx.workspaceId)).held).toBe(15);
    expect(await settle(fj.id)).toBe('succeeded');
    p = await repo.loadProject(db, ctx, p.id);
    const frames = p.assets.filter(a => a.kind === 'frame');
    expect(frames).toHaveLength(3); expect(frames.every(f => f.placeholder)).toBe(true);
    for (const s of p.scenes) p = await repo.approve(db, ctx, p.id, s.id, currentFrame(p, s)!.id);
    const vq = await jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'video' });
    expect(vq.credits).toBe(120);
    // A quote is invalid once the project changes.
    const stale = await jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'premium', scope: 'video' });
    p = await repo.saveProject(db, ctx, p.id, { ...p, brief: { ...p.brief, cta: 'Buy now' } }, p.revision); // overlay-only change keeps approvals
    await jobs.createJob(ctx, { quoteId: stale.id, idempotencyKey: 'stale-key-1' }).then(() => { /* overlay changes do not affect clip quotes */ });
    await expect(jobs.createJob(ctx, { quoteId: vq.id, idempotencyKey: 'video-key-1' })).rejects.toMatchObject({ status: 409 }); // project already has a job running
    const [running] = await db.query<{ id: string }>("select id from public.jobs where idempotency_key = 'stale-key-1'");
    expect(await settle(running.id)).toBe('review');
    const w = await repo.loadWallet(db, ctx.workspaceId);
    expect(w).toMatchObject({ held: 0, spent: 15 + 180, available: 250 - 195 });
    p = await repo.loadProject(db, ctx, p.id);
    expect(p.status).toBe('review');
    // Editing one scene invalidates only that scene; a new video quote covers just it.
    const s0 = p.scenes[0];
    p = await repo.saveProject(db, ctx, p.id, { ...p, scenes: p.scenes.map(s => (s.id === s0.id ? { ...s, prompt: 'A new hook' } : s)) }, p.revision);
    expect(sceneDepHash(p, p.scenes[0])).not.toBe(sceneDepHash(p, s0));
    await expect(jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'export' })).rejects.toThrow(/clip/);
    // Export after restoring the prompt (the earlier frame, approval and clip become current again).
    p = await repo.saveProject(db, ctx, p.id, { ...p, scenes: p.scenes.map(s => (s.id === s0.id ? { ...s, prompt: s0.prompt } : s)) }, p.revision);
    const eq = await jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'export' });
    const ej = await jobs.createJob(ctx, { quoteId: eq.id, idempotencyKey: eq.id });
    expect(await settle(ej.id)).toBe('review');
    p = await repo.loadProject(db, ctx, p.id);
    expect(p.status).toBe('review'); expect(p.qa?.decision).toBe('pending');
    await expect(assets.assetUrl(db, ctx, p.qa!.exportAssetId, true)).rejects.toMatchObject({ status: 403 });
    await db.query("insert into public.qa_reviews(workspace_id, project_id, export_asset_id, decision, reviewer_id) values ($1, $2, $3, 'approved', $4)", [ctx.workspaceId, p.id, p.qa!.exportAssetId, ctx.userId]);
    expect((await repo.loadProject(db, ctx, p.id)).status).toBe('ready');
    expect((await assets.assetUrl(db, ctx, p.qa!.exportAssetId, true)).placeholder).toBe(true);
  });

  it('releases unsettled credits on technical failure and enforces balance and per-user concurrency', async () => {
    const ctx = await user('fail@example.test');
    let p = await readyProject(ctx);
    const q0 = await jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'frame' });
    await expect(jobs.createJob(ctx, { quoteId: q0.id, idempotencyKey: q0.id })).rejects.toMatchObject({ status: 402 });
    expect(await db.query('select 1 from public.jobs where quote_id = $1', [q0.id])).toHaveLength(0);
    await credit(ctx, 'starter');
    setTestProviders({ generation: simulatedProvider({ delayMs: 0, failKinds: ['frame'] }) });
    const q1 = await jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'frame' });
    const j1 = await jobs.createJob(ctx, { quoteId: q1.id, idempotencyKey: q1.id });
    expect(await settle(j1.id)).toBe('failed');
    expect(await repo.loadWallet(db, ctx.workspaceId)).toMatchObject({ available: 100, held: 0, spent: 0 });
    p = await repo.loadProject(db, ctx, p.id);
    expect(p.status).toBe('failed'); expect(p.lastError).toMatch(/released/);
  });

  it('reconciles an unknown submission instead of resubmitting, and holds credits until resolved', async () => {
    const ctx = await user('unknown@example.test');
    await credit(ctx, 'starter');
    const p = await readyProject(ctx);
    // Provider can look the request up by idempotency key → continue without a second submission.
    const recon = simulatedProvider({ delayMs: 0, submitErrors: [new ProviderError('unknown', 'timeout')] });
    setTestProviders({ generation: recon });
    const q1 = await jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'frame', targetId: p.scenes[0].id });
    const j1 = await jobs.createJob(ctx, { quoteId: q1.id, idempotencyKey: q1.id });
    expect(await settle(j1.id)).toBe('succeeded');
    expect(recon.submissions.size).toBe(1);
    // Provider cannot look it up → manual attention, credits stay held, admin marks failed → released.
    const blind = simulatedProvider({ delayMs: 0, submitErrors: [new ProviderError('unknown', 'timeout')] });
    blind.reconcile = async () => null;
    setTestProviders({ generation: blind });
    const q2 = await jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'frame', targetId: p.scenes[1].id });
    const j2 = await jobs.createJob(ctx, { quoteId: q2.id, idempotencyKey: q2.id });
    await settle(j2.id); await settle(j2.id);
    const [att] = await db.query<{ status: string; tries: number }>('select status, tries from public.attempts where job_id = $1', [j2.id]);
    expect(att).toMatchObject({ status: 'unknown', tries: 1 });
    expect((await repo.loadWallet(db, ctx.workspaceId)).held).toBe(5);
    await jobs.resolveUnknown(j2.id, 'mark_failed');
    expect(await repo.loadWallet(db, ctx.workspaceId)).toMatchObject({ held: 0, spent: 5, available: 95 });
  });

  it('limits free analyses to one per day per account', async () => {
    const ctx = await user('analysis@example.test');
    await readyProject(ctx);
    const p2 = await repo.createProject(db, ctx, 'Second');
    const saved = await repo.saveProject(db, ctx, p2.id, { ...p2, rights: true }, p2.revision);
    await upload(ctx, saved.id, 'reference', mp4(8), 'video/mp4');
    await expect(jobs.startAnalysis(ctx, saved.id)).rejects.toMatchObject({ status: 429 });
  });
});

describe('durable runner (cron sweep)', () => {
  const sweepUntilDone = async (jobId: string) => {
    for (let i = 0; i < 40; i++) {
      await jobs.sweepJobs();
      const [j] = await db.query<{ status: string }>('select status from public.jobs where id = $1', [jobId]);
      if (!['queued', 'submitted', 'running'].includes(j.status)) return j.status;
    }
    return 'timeout';
  };
  const frameJob = async (ctx: Ctx, projectId: string, sceneId?: string) => {
    const q = await jobs.createServerQuote(db, ctx, { projectId, tier: 'professional', scope: 'frame', targetId: sceneId });
    return jobs.createJob(ctx, { quoteId: q.id, idempotencyKey: q.id });
  };

  it('finishes a job with nobody polling and records a heartbeat', async () => {
    const ctx = await user('cron@example.test');
    await credit(ctx, 'starter');
    const p = await readyProject(ctx);
    const j = await frameJob(ctx, p.id);
    expect(await sweepUntilDone(j.id)).toBe('succeeded');
    expect((await repo.loadWallet(db, ctx.workspaceId)).held).toBe(0);
    const beat = await jobs.runnerBeat(db);
    expect(beat).toMatchObject({ errors: 0 });
    expect(Date.now() - new Date(beat!.at).getTime()).toBeLessThan(60_000);
  });

  it('skips a job another runner holds, and resumes it once that lease is abandoned', async () => {
    const ctx = await user('lease@example.test');
    await credit(ctx, 'starter');
    const p = await readyProject(ctx);
    const j = await frameJob(ctx, p.id, p.scenes[0].id);
    await db.query("update public.jobs set lease_until = now() + interval '1 minute' where id = $1", [j.id]);
    await jobs.sweepJobs(); await jobs.advanceJob(j.id);
    expect(await db.query("select 1 from public.attempts where job_id = $1 and status = 'pending'", [j.id])).toHaveLength(1);
    await db.query("update public.jobs set lease_until = now() - interval '1 second' where id = $1", [j.id]); // the holder crashed
    expect(await sweepUntilDone(j.id)).toBe('succeeded');
  });

  it('a crash mid-submission is reconciled, never blindly resubmitted', async () => {
    const ctx = await user('crash@example.test');
    await credit(ctx, 'starter');
    const p = await readyProject(ctx);
    const provider = simulatedProvider({ delayMs: 0 });
    setTestProviders({ generation: provider });
    const j = await frameJob(ctx, p.id, p.scenes[0].id);
    // The previous runner committed 'submitting', reached the provider, then died before saving the request id.
    const [att] = await db.query<{ id: string; idempotency_key: string; task_id: string }>('select id, idempotency_key, task_id from public.attempts where job_id = $1', [j.id]);
    provider.submissions.set(att.idempotency_key, `sim_${Date.now()}_${att.task_id}`);
    await db.query("update public.attempts set status = 'submitting', tries = 1 where id = $1", [att.id]);
    await db.query("update public.jobs set lease_until = now() - interval '1 second' where id = $1", [j.id]);
    expect(await sweepUntilDone(j.id)).toBe('succeeded');
    expect(provider.submissions.size).toBe(1);
    expect(await db.query("select 1 from public.assets where job_id = $1 and kind = 'frame'", [j.id])).toHaveLength(1);
  });

  it('settles a job whose items all finished before a crash prevented settlement', async () => {
    const ctx = await user('settle@example.test');
    await credit(ctx, 'starter');
    const p = await readyProject(ctx);
    const j = await frameJob(ctx, p.id);
    await db.query("update public.attempts set status = 'failed', error = 'Provider rejected the request.', updated_at = now() - interval '1 hour' where job_id = $1", [j.id]);
    expect(await sweepUntilDone(j.id)).toBe('failed');
    expect(await repo.loadWallet(db, ctx.workspaceId)).toMatchObject({ held: 0, spent: 0, available: 100 });
  });

  it('flags a job that runs past an hour, keeps it running, and lets an admin stop the rest', async () => {
    const ctx = await user('stuck@example.test');
    await credit(ctx, 'starter');
    const p = await readyProject(ctx);
    setTestProviders({ generation: simulatedProvider({ delayMs: 10 * 60_000 }) }); // never finishes during the test
    const j = await frameJob(ctx, p.id);
    await db.query("update public.jobs set created_at = now() - interval '61 minutes' where id = $1", [j.id]);
    await jobs.sweepJobs();
    const [flagged] = await db.query<{ status: string; needs_attention: boolean; stage: string }>('select status, needs_attention, stage from public.jobs where id = $1', [j.id]);
    expect(flagged).toMatchObject({ needs_attention: true });
    expect(['submitted', 'running']).toContain(flagged.status);
    expect(flagged.stage).toMatch(/longer than expected/);
    await jobs.resolveUnknown(j.id, 'stop_remaining');
    const [stopped] = await db.query<{ status: string; needs_attention: boolean }>('select status, needs_attention from public.jobs where id = $1', [j.id]);
    expect(stopped).toMatchObject({ status: 'failed', needs_attention: false });
    expect(await repo.loadWallet(db, ctx.workspaceId)).toMatchObject({ held: 0, available: 100 });
  });
});

// Separate backends contending for the same rows. PGlite has one connection, so these need real PostgreSQL.
describe.runIf(pgUrl)('real PostgreSQL concurrency', () => {
  const reserve = (ws: string, op: string, amount: number) => db.query(`select public.wallet_reserve($1, $2, $3, null)`, [ws, op, amount]);
  const settled = <T,>(ps: Promise<T>[]) => Promise.allSettled(ps);
  const reasons = (rs: PromiseSettledResult<unknown>[]) => rs.filter(r => r.status === 'rejected').map(r => String((r as PromiseRejectedResult).reason)).join(' | ');
  // Earlier tests leave recent failed attempts, which would trip the provider circuit breaker here.
  beforeAll(async () => { await db.query("update public.attempts set updated_at = now() - interval '1 hour' where status = 'failed'"); });

  it('parallel holds can never overspend a wallet', async () => {
    const ctx = await user('race-hold@example.test');
    await credit(ctx, 'starter'); // 100 credits
    const results = await settled(Array.from({ length: 20 }, (_, i) => reserve(ctx.workspaceId, `race:${i}`, 10)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(10);
    expect(results.filter(r => r.status === 'rejected').every(r => /insufficient_credits/.test(String((r as PromiseRejectedResult).reason)))).toBe(true);
    expect(await repo.loadWallet(db, ctx.workspaceId)).toMatchObject({ available: 0, held: 100 });
  });

  it('the same hold sent from many connections is recorded once', async () => {
    const ctx = await user('race-same@example.test');
    await credit(ctx, 'starter');
    await settled(Array.from({ length: 10 }, () => reserve(ctx.workspaceId, 'job:same', 30)));
    expect(await db.query("select 1 from public.ledger_entries where operation_id = 'job:same'")).toHaveLength(1);
    expect(await repo.loadWallet(db, ctx.workspaceId)).toMatchObject({ available: 70, held: 30 });
    // Repeated, concurrent settlement settles once; a different amount for a finished operation is refused.
    await settled(Array.from({ length: 6 }, () => db.query(`select public.wallet_finalize($1, 'job:same', 20)`, [ctx.workspaceId])));
    expect(await repo.loadWallet(db, ctx.workspaceId)).toMatchObject({ available: 80, held: 0, spent: 20 });
    await expect(db.query(`select public.wallet_finalize($1, 'job:same', 25)`, [ctx.workspaceId])).rejects.toThrow(/operation_conflict/);
  });

  it('duplicate and re-delivered capture webhooks credit a payment once', async () => {
    const ctx = await user('race-pay@example.test');
    const order = await payments.createOrder(db, ctx, 'starter');
    const [pay] = await db.query<{ amount_paise: number }>('select amount_paise from public.payments where order_id = $1', [order.orderId]);
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_race_1', order_id: order.orderId, amount: pay.amount_paise, currency: 'INR', status: 'captured' } } } });
    const sig = payments.signWebhook(body, payments.localWebhookSecret());
    // Same event delivered in parallel, plus the same capture under new event ids (provider retries).
    await settled([...Array.from({ length: 6 }, () => payments.handleRazorpayWebhook(body, sig, 'evt_race_1')), ...Array.from({ length: 4 }, (_, i) => payments.handleRazorpayWebhook(body, sig, `evt_race_retry_${i}`))]);
    expect(await repo.loadWallet(db, ctx.workspaceId)).toMatchObject({ available: 100 });
    expect(await db.query("select 1 from public.ledger_entries where kind = 'purchase' and workspace_id = $1", [ctx.workspaceId])).toHaveLength(1);
  });

  it('one quote submitted in parallel becomes one job with one hold', async () => {
    const ctx = await user('race-job@example.test');
    await credit(ctx, 'starter');
    const p = await readyProject(ctx);
    const q = await jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'frame' });
    const results = await settled(Array.from({ length: 8 }, (_, i) => jobs.createJob(ctx, { quoteId: q.id, idempotencyKey: i % 2 ? q.id : `${q.id}-other` })));
    const ids = new Set(results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<{ id: string }>).value.id));
    expect(ids.size, reasons(results)).toBe(1);
    expect(await db.query('select 1 from public.jobs where quote_id = $1', [q.id])).toHaveLength(1);
    expect((await repo.loadWallet(db, ctx.workspaceId)).held).toBe(q.credits);
  });

  it('parallel jobs on different projects respect the per-user limit', async () => {
    const base = await user('race-cap@example.test');
    const ctx = { ...base, isAdmin: true }; // admins skip the one-free-analysis-a-day rule, so three projects can be prepared
    await credit(ctx, 'studio');
    const projects = [await readyProject(ctx), await readyProject(ctx), await readyProject(ctx)];
    const quotes = await Promise.all(projects.map(p => jobs.createServerQuote(db, ctx, { projectId: p.id, tier: 'professional', scope: 'frame' })));
    const results = await settled(quotes.map(q => jobs.createJob(ctx, { quoteId: q.id, idempotencyKey: q.id })));
    expect(results.filter(r => r.status === 'fulfilled'), reasons(results)).toHaveLength(2); // perUserConcurrency defaults to 2
    expect(reasons(results)).toMatch(/2 jobs at a time/);
    const [{ n }] = await db.query<{ n: string }>("select count(*) n from public.jobs where user_id = $1 and kind <> 'analysis' and status in ('queued', 'submitted', 'running')", [ctx.userId]);
    expect(Number(n)).toBe(2);
  });
});
