import 'server-only';
import { z } from 'zod';
import { assertQuote, buildScenePrompt, createQuote, currentClip, effectsOf, logoAsset, productAssets, currentSheet, referenceAsset, setRoles } from '@/lib/domain/project';
import { quoteScopes, type JobView, type Project, type Quote, type QuoteTask, type Tier } from '@/lib/domain/schema';
import type { Ctx } from './auth';
import { mode, pricing } from './config';
import { getDb, type Queryable } from './db';
import { domain, HttpError } from './errors';
import { analyzer, providerFor } from './providers';
import { ProviderError, type ProviderAdapter, type ProviderFile, type ProviderTask } from './providers/types';
import { finalizeCredits, loadProject, reserveCredits, writeProjectFacts } from './repo';
import { storeOutput } from './assets';
import { getStorage } from './storage';

export const quoteInput = z.object({ projectId: z.uuid(), tier: z.enum(['professional', 'premium']), scope: z.enum(quoteScopes), targetId: z.string().max(80).optional() });
export const jobInput = z.object({ quoteId: z.uuid(), idempotencyKey: z.string().min(8).max(100) });

type Limits = { dailySpendCapInr: number; perUserConcurrency: number; generationPaused: boolean; circuitBreakers: Record<string, 'open' | 'closed'>; freeAnalysesPerDay?: number };
export async function limits(q: Queryable): Promise<Limits> {
  const [row] = await q.query<{ value: Limits }>("select value from public.admin_settings where key = 'limits'");
  const defaults: Limits = { dailySpendCapInr: 5000, perUserConcurrency: 2, generationPaused: false, circuitBreakers: {}, freeAnalysesPerDay: 1 };
  return { ...defaults, ...((row?.value ?? {}) as Partial<Limits>) };
}

function requirePricing() {
  const p = pricing();
  if (!p) throw new HttpError(503, 'Pricing has not been configured from measured costs yet, so quotes are unavailable.', 'not_configured');
  return p;
}

// ---------------------------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------------------------
type QuoteRow = { id: string; project_id: string; tier: Tier; scope: Quote['scope']; target_id: string | null; credits: number; seconds: number; fingerprint: string; pricing_version: string; tasks: QuoteTask[]; model: string; native_resolution: string; retry_policy: string; illustrative: boolean; expires_at: Date; consumed_at: Date | null; user_id: string };
const rowToQuote = (r: QuoteRow): Quote => ({ id: r.id, projectId: r.project_id, tier: r.tier, scope: r.scope, targetId: r.target_id ?? undefined, credits: r.credits, seconds: r.seconds, fingerprint: r.fingerprint, pricingVersion: r.pricing_version, tasks: r.tasks, model: r.model, nativeResolution: r.native_resolution, retryPolicy: r.retry_policy, illustrative: r.illustrative, expiresAt: new Date(r.expires_at).getTime() });

export async function createServerQuote(q: Queryable, ctx: Ctx, raw: unknown): Promise<Quote> {
  const input = quoteInput.parse(raw);
  const pr = requirePricing();
  const project = await loadProject(q, ctx, input.projectId);
  if (project.sample) throw new HttpError(422, 'Sample projects cannot be generated.', 'rejected');
  const quote = domain(() => createQuote(project, input.tier, input.scope, input.targetId, pr));
  await q.query('insert into public.quotes(id, workspace_id, project_id, user_id, tier, scope, target_id, credits, seconds, fingerprint, pricing_version, tasks, model, native_resolution, retry_policy, illustrative, expires_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',
    [quote.id, ctx.workspaceId, project.id, ctx.userId, quote.tier, quote.scope, quote.targetId ?? null, quote.credits, quote.seconds, quote.fingerprint, quote.pricingVersion, JSON.stringify(quote.tasks), quote.model, quote.nativeResolution, quote.retryPolicy, quote.illustrative, new Date(quote.expiresAt)]);
  return quote;
}

// ---------------------------------------------------------------------------------------------
// Job creation: quote re-verified against current server state, limits checked, credits reserved atomically.
// ---------------------------------------------------------------------------------------------
function providerTasks(p: Project, quote: Quote): (QuoteTask & { provider: ProviderTask })[] {
  return quote.tasks.map(t => {
    const scene = p.scenes.find(s => s.id === t.sceneId);
    const base = { taskId: t.taskId, kind: t.kind, tier: quote.tier, sceneId: t.sceneId, candidateId: t.candidateId, seconds: t.seconds } as const;
    if (t.kind === 'frame' && scene) return { ...t, provider: { ...base, label: scene.title, prompt: buildScenePrompt(p, scene), inputAssetIds: [...productAssets(p).map(a => a.id), ...scene.roleIds.map(r => currentSheet(p, p.selections[r] ?? '')?.id).filter((x): x is string => Boolean(x))], overlay: { brand: p.brief.brand, cta: '', font: '', color: p.brief.color } } };
    if (t.kind === 'clip' && scene) return { ...t, provider: { ...base, label: scene.title, prompt: buildScenePrompt(p, scene), inputAssetIds: [scene.approval!.frameAssetId], overlay: { brand: p.brief.brand, cta: '', font: '', color: p.brief.color } } };
    if (t.kind === 'character') {
      const c = p.candidates.find(x => x.id === t.candidateId)!;
      return { ...t, provider: { ...base, label: c.name, prompt: `Original character identity sheet on a plain warm background: ${c.description}. Four consistent views of the same adult: front, profile, three-quarter, full body. No resemblance to any real or famous person. No text.`, inputAssetIds: [] } };
    }
    if (t.kind === 'export') {
      return { ...t, provider: { ...base, label: p.name, prompt: '', inputAssetIds: p.scenes.map(s => currentClip(p, s)!.id), overlay: { brand: p.brief.brand, cta: p.brief.cta, font: p.brief.font, color: p.brief.color, logoAssetId: logoAsset(p)?.id, ...effectsOf(p.brief) } } };
    }
    throw new HttpError(409, 'The project changed. Request a new quote.', 'changed');
  });
}

async function assertCapacity(q: Queryable, ctx: Ctx, credits: number, providerNames: string[]) {
  // Count-then-insert is only safe if job creations cannot interleave: without this, parallel requests could all
  // pass the per-user and daily caps. Held for the (short) job-creation transaction only.
  await q.query("select pg_advisory_xact_lock(hashtext('vidzo:job-capacity'))");
  const lim = await limits(q);
  if (lim.generationPaused) throw new HttpError(503, 'Generation is paused by the VIDZO team. No credits were reserved.', 'paused');
  const [{ n }] = await q.query<{ n: string }>("select count(*) n from public.jobs where user_id = $1 and status in ('queued', 'submitted', 'running') and kind <> 'analysis'", [ctx.userId]);
  if (Number(n) >= lim.perUserConcurrency) throw new HttpError(429, `You can run ${lim.perUserConcurrency} jobs at a time. Wait for one to finish.`, 'concurrency');
  const pr = requirePricing();
  const [{ committed }] = await q.query<{ committed: string }>("select coalesce(sum(credits_reserved), 0) committed from public.jobs where created_at > date_trunc('day', now()) and status <> 'failed'");
  if (((Number(committed) + credits) * pr.creditValuePaise) / 100 > lim.dailySpendCapInr) throw new HttpError(503, 'Today’s generation capacity is used up. Please try again tomorrow; no credits were reserved.', 'spend_cap');
  for (const name of providerNames) {
    if (lim.circuitBreakers[name] === 'open') throw new HttpError(503, 'This provider is temporarily unavailable. No credits were reserved.', 'circuit_open');
    const [{ f }] = await q.query<{ f: string }>("select count(*) f from public.attempts where provider = $1 and status = 'failed' and updated_at > now() - interval '15 minutes'", [name]);
    if (Number(f) >= 5) throw new HttpError(503, 'The provider is failing repeatedly, so new jobs are paused for a few minutes. No credits were reserved.', 'circuit_open');
  }
}

export async function createJob(ctx: Ctx, raw: unknown): Promise<{ id: string; status: string; duplicate: boolean }> {
  const input = jobInput.parse(raw);
  const db = await getDb();
  return db.tx(async q => {
    const [existing] = await q.query<{ id: string; status: string }>('select id, status from public.jobs where workspace_id = $1 and idempotency_key = $2', [ctx.workspaceId, input.idempotencyKey]);
    if (existing) return { ...existing, duplicate: true };
    const [row] = await q.query<QuoteRow>('select * from public.quotes where id = $1 and workspace_id = $2 for update', [input.quoteId, ctx.workspaceId]);
    if (!row || row.user_id !== ctx.userId) throw new HttpError(404, 'Quote not found.', 'not_found');
    if (row.consumed_at) {
      const [j] = await q.query<{ id: string; status: string }>('select id, status from public.jobs where quote_id = $1', [row.id]);
      if (j) return { ...j, duplicate: true };
      throw new HttpError(409, 'This quote was already used.', 'consumed');
    }
    const quote = rowToQuote(row);
    const pr = requirePricing();
    const project = await loadProject(q, ctx, quote.projectId, true);
    if (project.activeJobId) throw new HttpError(409, 'This project already has a job running.', 'busy');
    domain(() => assertQuote(project, quote, pr));
    const tasks = providerTasks(project, quote);
    const providers = [...new Set(tasks.map(t => providerFor(t.kind).name))];
    await assertCapacity(q, ctx, quote.credits, providers);
    const id = crypto.randomUUID();
    await q.query("insert into public.jobs(id, workspace_id, project_id, user_id, quote_id, idempotency_key, kind, status, stage, credits_reserved, input) values ($1,$2,$3,$4,$5,$6,$7,'queued','Queued',$8,$9)",
      [id, ctx.workspaceId, project.id, ctx.userId, quote.id, input.idempotencyKey, quote.scope, quote.credits, JSON.stringify({ tier: quote.tier, scope: quote.scope, tasks })]);
    if (quote.credits > 0) await reserveCredits(q, ctx.workspaceId, 'job:' + id, quote.credits, id);
    await q.query('update public.quotes set consumed_at = now() where id = $1', [quote.id]);
    for (const t of tasks) {
      const p = providerFor(t.kind);
      await q.query("insert into public.attempts(job_id, workspace_id, task_id, kind, scene_id, candidate_id, provider, endpoint, idempotency_key, status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')",
        [id, ctx.workspaceId, t.taskId, t.kind, t.sceneId ?? null, t.candidateId ?? null, p.name, p.endpoint(t.provider), `${id}:${t.taskId}`]);
    }
    return { id, status: 'queued', duplicate: false };
  });
}

/** Free reference analysis: one per verified account per day (admins exempt). Technical failures do not count. */
export async function startAnalysis(ctx: Ctx, projectId: string): Promise<{ id: string; status: string }> {
  const db = await getDb();
  const az = analyzer();
  return db.tx(async q => {
    const project = await loadProject(q, ctx, projectId, true);
    if (project.activeJobId) throw new HttpError(409, 'This project already has a job running.', 'busy');
    const ref = referenceAsset(project);
    if (!project.rights || ref?.status !== 'verified') throw new HttpError(422, 'Upload a verified reference and confirm your rights first.', 'rejected');
    const lim = await limits(q);
    const [{ n }] = await q.query<{ n: string }>("select count(*) n from public.jobs where user_id = $1 and kind = 'analysis' and status <> 'failed' and created_at > now() - interval '1 day'", [ctx.userId]);
    if (!ctx.isAdmin && Number(n) >= (lim.freeAnalysesPerDay ?? 1)) throw new HttpError(429, 'You have used today’s free analysis. Try again tomorrow or contact support.', 'analysis_limit');
    const id = crypto.randomUUID();
    await q.query("insert into public.jobs(id, workspace_id, project_id, user_id, idempotency_key, kind, status, stage, input) values ($1,$2,$3,$4,$5,'analysis','queued','Queued',$6)", [id, ctx.workspaceId, project.id, ctx.userId, 'analysis:' + id, JSON.stringify({ referenceAssetId: ref.id })]);
    await q.query("insert into public.attempts(job_id, workspace_id, task_id, kind, provider, endpoint, idempotency_key, status) values ($1,$2,'analysis','analysis',$3,'analyze',$4,'pending')", [id, ctx.workspaceId, az.name, id + ':analysis']);
    return { id, status: 'queued' };
  });
}

// ---------------------------------------------------------------------------------------------
// Orchestration. Each tick takes a lease so only one runner advances a job; each attempt transition is
// committed before the next external call, so a crash can always be resumed or reconciled.
// ---------------------------------------------------------------------------------------------
type JobRow = { id: string; workspace_id: string; project_id: string; user_id: string; kind: string; status: string; credits_reserved: number; created_at: Date; lease_token: string; input: { tier?: Tier; tasks?: (QuoteTask & { provider: ProviderTask })[]; referenceAssetId?: string } };
type AttemptRow = { id: string; task_id: string; kind: string; status: string; tries: number; request_id: string | null; idempotency_key: string; next_at: Date; error: string | null };
const terminal = (s: string) => s === 'succeeded' || s === 'failed';
const MAX_TRIES = 3; // first attempt + two transient retries
const POLL_MS = Number(process.env.VIDZO_POLL_MS ?? 1500);

/** A job still unfinished after this long is flagged for the team. It keeps running and its credits stay held. */
export const JOB_ATTENTION_MS = 60 * 60_000;

// The lease's exact timestamp is its token: a runner renews or releases only the lease it holds, so one whose
// lease lapsed (a slow download, a frozen isolate) can never clear or extend another runner's lease.
const LEASE = "lease_until = now() + interval '120 seconds'";
async function renewLease(jobId: string, token: string): Promise<string | null> {
  const [r] = await (await getDb()).query<{ lease_token: string }>(`update public.jobs set ${LEASE} where id = $1 and lease_until::text = $2 and lease_until > now() returning lease_until::text as lease_token`, [jobId, token]);
  return r?.lease_token ?? null;
}

/**
 * allowLong: only the background runner may make synchronous provider calls (minutes long). Request-time
 * callers leave those steps for the next sweep, because a request's background time is cut after ~30 s.
 */
export async function advanceJob(jobId: string, { allowLong = false }: { allowLong?: boolean } = {}): Promise<void> {
  const db = await getDb();
  const [job] = await db.query<JobRow>(`update public.jobs set ${LEASE} where id = $1 and status in ('queued', 'submitted', 'running') and (lease_until is null or lease_until < now()) returning *, lease_until::text as lease_token`, [jobId]);
  if (!job) return;
  let token: string | null = job.lease_token;
  try {
    const attempts = await db.query<AttemptRow>('select * from public.attempts where job_id = $1 order by created_at, task_id', [jobId]);
    for (const a of attempts) {
      if (terminal(a.status) || new Date(a.next_at).getTime() > Date.now()) continue;
      const long = isLong(job, a);
      if (long && !allowLong) continue;
      token = await renewLease(jobId, token);
      if (!token) return; // lease lost: another runner owns the job now
      // A long call keeps renewing the lease so no other runner takes the job mid-render.
      const beat = long ? setInterval(() => { if (token) void renewLease(jobId, token).then(t => { if (t) token = t; }).catch(() => undefined); }, 30_000) : undefined;
      try { await step(job, a); } finally { clearInterval(beat); }
    }
    await settleIfDone(job);
  } finally {
    if (token) await db.query('update public.jobs set lease_until = null where id = $1 and lease_until::text = $2', [jobId, token]);
  }
}

/**
 * The durable runner. A Cloudflare cron calls this every minute (src/worker.ts), so jobs progress with every
 * browser closed. Bounded per run; leases make it safe alongside the request-time fast path. Picks jobs
 * with a due attempt, plus jobs whose attempts all finished but were never settled (a crash before settlement).
 */
export async function sweepJobs({ maxJobs = 10, budgetMs = 20_000 }: { maxJobs?: number; budgetMs?: number } = {}) {
  const started = Date.now();
  const db = await getDb();
  const open = "a.job_id = j.id and a.status not in ('succeeded', 'failed')";
  const due = await db.query<{ id: string }>(`select j.id from public.jobs j where j.status in ('queued', 'submitted', 'running') and (j.lease_until is null or j.lease_until < now())
    and (exists (select 1 from public.attempts a where ${open} and a.next_at <= now()) or not exists (select 1 from public.attempts a where ${open}))
    order by j.updated_at limit $1`, [maxJobs]);
  let advanced = 0, errors = 0;
  for (const { id } of due) {
    if (Date.now() - started > budgetMs) break;
    try { await advanceJob(id, { allowLong: true }); advanced++; } catch (e) { errors++; console.error('[vidzo] sweep: advance failed', id, e instanceof Error ? e.message.slice(0, 200) : e); }
  }
  const [{ active, attention }] = await db.query<{ active: string; attention: string }>("select count(*) active, count(*) filter (where needs_attention) attention from public.jobs where status in ('queued', 'submitted', 'running')");
  const beat = { at: new Date().toISOString(), due: due.length, advanced, errors, active: Number(active), attention: Number(attention), ms: Date.now() - started };
  await db.query("insert into public.admin_settings(key, value) values ('runner', $1) on conflict (key) do update set value = excluded.value, updated_at = now()", [JSON.stringify(beat)]);
  return beat;
}

const g = globalThis as unknown as { __vidzoLocalRunner?: boolean };
/** Local test backend stand-in for the Cloudflare cron: a sweep every few seconds in this Node process. */
export function startLocalRunner() {
  if (mode() !== 'local' || g.__vidzoLocalRunner) return;
  g.__vidzoLocalRunner = true;
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    sweepJobs().catch(e => console.error('[vidzo] local sweep failed', e)).finally(() => { busy = false; });
  }, 3000);
  timer.unref?.();
}

export type RunnerBeat = Awaited<ReturnType<typeof sweepJobs>>;
export async function runnerBeat(q: Queryable): Promise<RunnerBeat | null> {
  const [row] = await q.query<{ value: RunnerBeat }>("select value from public.admin_settings where key = 'runner'");
  return row?.value ?? null;
}

async function setAttempt(id: string, patch: Partial<{ status: string; request_id: string; error: string | null; tries: number; next_in_ms: number; output_asset_id: string }>) {
  const db = await getDb();
  await db.query(`update public.attempts set status = coalesce($2, status), request_id = coalesce($3, request_id), error = $4, tries = coalesce($5, tries),
    next_at = now() + ($6 || ' milliseconds')::interval, output_asset_id = coalesce($7, output_asset_id), updated_at = now() where id = $1`,
    [id, patch.status ?? null, patch.request_id ?? null, patch.error ?? null, patch.tries ?? null, String(patch.next_in_ms ?? 0), patch.output_asset_id ?? null]);
}

type JobTask = QuoteTask & { provider: ProviderTask };
const taskOf = (job: JobRow, a: AttemptRow): JobTask => job.input.tasks!.find(t => t.taskId === a.task_id)!;
function isLong(job: JobRow, a: AttemptRow) {
  if (job.kind === 'analysis') return false;
  try { return Boolean(providerFor(taskOf(job, a).kind).run); } catch { return false; }
}

async function signedInputs(job: JobRow, task: JobTask) {
  const storage = await getStorage(), db = await getDb();
  const keys = await db.query<{ id: string; object_key: string; mime: string }>("select id, object_key, mime from public.assets where id = any($1::uuid[]) and workspace_id = $2 and status = 'verified'", [[...task.provider.inputAssetIds, task.provider.overlay?.logoAssetId].filter(Boolean), job.workspace_id]);
  const urls: Record<string, string> = {};
  for (const k of keys) urls[k.id] = await storage.signGet(k.object_key, { ttlSeconds: 3600, mime: k.mime });
  return { urls };
}

/** Stores a result at most once, even if a lapsed lease let two runners finish the same item. */
async function storeResult(job: JobRow, task: JobTask, a: AttemptRow, file: ProviderFile) {
  await (await getDb()).tx(async q => {
    const [locked] = await q.query<{ status: string }>('select status from public.attempts where id = $1 for update', [a.id]);
    if (terminal(locked.status)) return;
    const [{ n }] = await q.query<{ n: string }>("select count(*) n from public.assets where project_id = $1 and kind = $2 and coalesce(scene_id, '') = coalesce($3, '') and coalesce(candidate_id, '') = coalesce($4, '')", [job.project_id, task.kind, task.sceneId ?? null, task.candidateId ?? null]);
    const outputId = await storeOutput(q, job.workspace_id, { id: job.project_id }, { kind: task.kind, name: file.name, mime: file.mime, bytes: file.bytes, placeholder: file.placeholder, sceneId: task.sceneId, candidateId: task.candidateId, depHash: task.depHash, version: Number(n) + 1, jobId: job.id, meta: file.meta });
    await q.query("update public.attempts set status = 'succeeded', output_asset_id = $2, error = null, updated_at = now() where id = $1", [a.id, outputId]);
  });
}

/** Synchronous providers: the whole item happens in one call and redoing it is safe, so interruptions retry. */
async function stepRun(job: JobRow, a: AttemptRow, task: JobTask, run: NonNullable<ProviderAdapter['run']>) {
  if (a.status === 'submitting' || a.status === 'unknown') {
    // The runner died mid-call. Nothing external was charged, so retry within the normal limit.
    await setAttempt(a.id, a.tries < MAX_TRIES ? { status: 'pending', error: 'The previous run was interrupted; running it again.' } : { status: 'failed', error: 'Assembly was interrupted repeatedly.' });
    return;
  }
  if (a.status !== 'pending') return;
  await setAttempt(a.id, { status: 'submitting', tries: a.tries + 1, error: null });
  await (await getDb()).query("update public.jobs set status = 'running', stage = 'Assembling your ad', updated_at = now() where id = $1 and status in ('queued', 'submitted')", [job.id]);
  try {
    await storeResult(job, task, a, await run(task.provider, await signedInputs(job, task), a.idempotency_key));
  } catch (e) {
    const pe = e instanceof ProviderError ? e : new ProviderError('transient', e instanceof Error ? e.message.slice(0, 200) : 'Assembly failed.');
    if (pe.kind !== 'permanent' && a.tries + 1 < MAX_TRIES) await setAttempt(a.id, { status: 'pending', error: pe.message, next_in_ms: 30_000 * 2 ** a.tries });
    else await setAttempt(a.id, { status: 'failed', error: pe.message });
  }
}

async function step(job: JobRow, a: AttemptRow) {
  if (job.kind === 'analysis') return stepAnalysis(job, a);
  const task = taskOf(job, a);
  const provider = providerFor(task.kind);
  if (provider.run) return stepRun(job, a, task, provider.run);
  try {
    if (a.status === 'submitting') { await setAttempt(a.id, { status: 'unknown', error: 'Submission was interrupted; reconciling before any resubmission.' }); return; }
    if (a.status === 'unknown') {
      const found = await provider.reconcile(a.idempotency_key, task.provider);
      if (found) await setAttempt(a.id, { status: 'submitted', request_id: found, error: null });
      else await setAttempt(a.id, { status: 'unknown', error: a.error ?? 'Provider outcome unknown; awaiting manual reconciliation.', next_in_ms: 30_000 });
      return;
    }
    if (a.status === 'pending') {
      await setAttempt(a.id, { status: 'submitting', tries: a.tries + 1, error: null });
      const inputs = await signedInputs(job, task);
      try {
        const { requestId } = await provider.submit(task.provider, inputs, a.idempotency_key);
        await setAttempt(a.id, { status: 'submitted', request_id: requestId, next_in_ms: POLL_MS });
        await (await getDb()).query("update public.jobs set status = 'submitted', stage = 'Submitted to the production queue', updated_at = now() where id = $1 and status = 'queued'", [job.id]);
      } catch (e) {
        const pe = e instanceof ProviderError ? e : new ProviderError('unknown', 'Submission failed.');
        if (pe.kind === 'transient' && a.tries + 1 < MAX_TRIES) await setAttempt(a.id, { status: 'pending', error: pe.message, next_in_ms: 2000 * 2 ** a.tries });
        else if (pe.kind === 'unknown') await setAttempt(a.id, { status: 'unknown', error: pe.message });
        else await setAttempt(a.id, { status: 'failed', error: pe.message });
      }
      return;
    }
    // submitted / running
    const st = await provider.status(a.request_id!, task.provider);
    if (st.state === 'queued' || st.state === 'running') {
      await setAttempt(a.id, { status: st.state === 'running' ? 'running' : 'submitted', next_in_ms: POLL_MS });
      if (st.state === 'running') await (await getDb()).query("update public.jobs set status = 'running', updated_at = now() where id = $1 and status in ('queued', 'submitted')", [job.id]);
      return;
    }
    if (st.state === 'failed') { await setAttempt(a.id, { status: 'failed', error: st.error ?? 'Generation failed.' }); return; }
    await storeResult(job, task, a, await provider.result(a.request_id!, task.provider));
  } catch (e) {
    // Status/result polling problems are not proof of failure: back off and try again later.
    const msg = e instanceof Error ? e.message.slice(0, 200) : 'Polling failed.';
    await setAttempt(a.id, { status: a.status === 'pending' ? 'pending' : a.status, error: msg, next_in_ms: 10_000 });
  }
}

async function stepAnalysis(job: JobRow, a: AttemptRow) {
  const db = await getDb();
  try {
    await setAttempt(a.id, { status: 'running', tries: a.tries + 1 });
    await db.query("update public.jobs set status = 'running', stage = 'Analysing the reference', updated_at = now() where id = $1", [job.id]);
    const [ref] = await db.query<{ object_key: string; mime: string; bytes: string; meta: { seconds?: number } }>('select object_key, mime, bytes, meta from public.assets where id = $1 and workspace_id = $2 and status = \'verified\'', [job.input.referenceAssetId, job.workspace_id]);
    if (!ref) throw new Error('The reference is no longer available.');
    const storage = await getStorage();
    const durationMs = Math.round((ref.meta.seconds ?? 0) * 1000);
    const analysis = await analyzer().analyze({ mime: ref.mime, durationMs, bytes: () => storage.readRange(ref.object_key, 0, Number(ref.bytes)) });
    await db.tx(async q => {
      const project = await loadProject(q, { workspaceId: job.workspace_id }, job.project_id, true);
      const next = setRoles({ ...project, analysis: { ...analysis, roles: [] } }, analysis.roles);
      await writeProjectFacts(q, { workspaceId: job.workspace_id }, { ...next, step: Math.max(project.step, 1) });
    });
    await setAttempt(a.id, { status: 'succeeded' });
  } catch (e) {
    console.error('[vidzo] analysis failed', e);
    await setAttempt(a.id, { status: 'failed', error: 'The reference could not be analysed. No credits were charged.' });
  }
}

async function settleIfDone(job: JobRow) {
  const db = await getDb();
  const attempts = await db.query<{ task_id: string; status: string; error: string | null; next_at: Date }>('select task_id, status, error, next_at from public.attempts where job_id = $1', [job.id]);
  const done = attempts.filter(a => terminal(a.status)).length;
  // Flag for manual reconciliation only after one reconciliation attempt failed to find the request.
  const unknown = attempts.some(a => a.status === 'unknown' && new Date(a.next_at).getTime() > Date.now());
  const overdue = Date.now() - new Date(job.created_at).getTime() > JOB_ATTENTION_MS;
  if (done < attempts.length) {
    const label = job.kind === 'analysis' ? 'Analysing the reference' : `${done} of ${attempts.length} ${job.kind === 'characters' || job.kind === 'character' ? 'identity sheets' : job.kind === 'frame' ? 'frames' : job.kind === 'export' ? 'assembly steps' : 'clips'} complete`;
    await db.query('update public.jobs set stage = $2, needs_attention = $3, updated_at = now() where id = $1', [job.id, unknown ? 'Waiting for provider reconciliation · credits stay held' : overdue ? `${label} · taking longer than expected, the VIDZO team is checking · credits stay held` : label, unknown || overdue]);
    return;
  }
  const ok = new Set(attempts.filter(a => a.status === 'succeeded').map(a => a.task_id));
  const settle = (job.input.tasks ?? []).filter(t => ok.has(t.taskId)).reduce((n, t) => n + t.credits, 0);
  const status = ok.size === 0 ? 'failed' : job.kind === 'video' || job.kind === 'scene' || job.kind === 'export' ? 'review' : 'succeeded';
  const failed = attempts.length - ok.size;
  const stage = status === 'failed' ? 'Failed · unsettled credits released' : failed ? `${ok.size} of ${attempts.length} complete · credits for failed items released` : job.kind === 'export' ? 'Awaiting human quality review' : status === 'review' ? 'Ready for your review' : 'Complete';
  await db.tx(async q => {
    const [locked] = await q.query<{ status: string }>('select status from public.jobs where id = $1 for update', [job.id]);
    if (!['queued', 'submitted', 'running'].includes(locked.status)) return;
    if (job.credits_reserved > 0) await finalizeCredits(q, job.workspace_id, 'job:' + job.id, settle);
    const error = status === 'failed' ? (attempts.find(a => a.error)?.error ?? 'Generation failed.') + ' Unsettled credits were released.' : null;
    await q.query('update public.jobs set status = $2, stage = $3, credits_settled = $4, error = $5, needs_attention = false, finished_at = now(), updated_at = now() where id = $1', [job.id, status, stage, settle, error]);
  });
}

/** Request-time fast path that starts work right after a job is created. The cron sweep guarantees progress. */
export async function drive(jobId: string, budgetMs = 10 * 60_000) {
  const until = Date.now() + budgetMs;
  while (Date.now() < until) {
    await advanceJob(jobId).catch(e => console.error('[vidzo] advance failed', e));
    const [j] = await (await getDb()).query<{ status: string; needs_attention: boolean }>('select status, needs_attention from public.jobs where id = $1', [jobId]);
    if (!j || !['queued', 'submitted', 'running'].includes(j.status) || j.needs_attention) return;
    await new Promise(r => setTimeout(r, 1000));
  }
}

export async function jobView(q: Queryable, ws: string, jobId: string): Promise<JobView> {
  const [j] = await q.query<{ id: string; project_id: string; kind: string; status: JobView['status']; stage: string; error: string | null; credits_reserved: number; credits_settled: number; created_at: Date; updated_at: Date }>('select * from public.jobs where id = $1 and workspace_id = $2', [jobId, ws]);
  if (!j) throw new HttpError(404, 'Job not found.', 'not_found');
  const tasks = await q.query<{ task_id: string; kind: string; scene_id: string | null; status: string; error: string | null }>('select task_id, kind, scene_id, status, error from public.attempts where job_id = $1 order by created_at, task_id', [jobId]);
  return { id: j.id, projectId: j.project_id, kind: j.kind, status: j.status, stage: j.stage, error: j.error ?? undefined, creditsReserved: j.credits_reserved, creditsSettled: j.credits_settled, createdAt: new Date(j.created_at).toISOString(), updatedAt: new Date(j.updated_at).toISOString(), tasks: tasks.map(t => ({ taskId: t.task_id, kind: t.kind, sceneId: t.scene_id ?? undefined, status: t.status, error: t.error ?? undefined })) };
}

export const resolveActions = ['mark_failed', 'resubmit', 'stop_remaining'] as const;
/**
 * Admin exception path. mark_failed / resubmit act on unknown provider outcomes; resubmitting may cause a
 * duplicate provider charge, so it is an explicit decision. stop_remaining ends every unfinished item of a stuck
 * job: delivered items stay settled and the rest of the hold is released.
 */
export async function resolveUnknown(jobId: string, action: (typeof resolveActions)[number]) {
  const db = await getDb();
  const statuses = action === 'stop_remaining' ? ['pending', 'submitting', 'submitted', 'running', 'unknown'] : ['unknown', 'submitting'];
  const error = action === 'resubmit' ? null : action === 'stop_remaining' ? 'Stopped by the VIDZO team; its credits were released.' : 'Marked failed by an administrator after reconciliation.';
  await db.query(`update public.attempts set status = $2, error = $3, next_at = now(), updated_at = now() where job_id = $1 and status = any($4::text[])`,
    [jobId, action === 'resubmit' ? 'pending' : 'failed', error, statuses]);
  await db.query('update public.jobs set needs_attention = false where id = $1', [jobId]);
  await advanceJob(jobId);
}

