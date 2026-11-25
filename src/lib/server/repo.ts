import 'server-only';
import { approveScene, currentExport, newProject } from '@/lib/domain/project';
import { ConflictError, mergeClientEdits } from '@/lib/domain/merge';
import { projectSchema, type Asset, type Project, type Wallet } from '@/lib/domain/schema';
import type { Ctx } from './auth';
import type { Queryable } from './db';
import { domain, HttpError } from './errors';

type AssetRow = { id: string; kind: Asset['kind']; name: string; mime: Asset['mime']; bytes: string | number; status: Asset['status']; placeholder: boolean; meta: Record<string, unknown>; scene_id: string | null; candidate_id: string | null; dep_hash: string | null; version: number | null; reject_reason: string | null; created_at: Date | string };
const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export function rowToAsset(r: AssetRow): Asset {
  const meta = r.meta ?? {};
  return {
    id: r.id, kind: r.kind, name: r.name, mime: r.mime, bytes: Number(r.bytes), status: r.status, placeholder: r.placeholder,
    seconds: typeof meta.seconds === 'number' ? meta.seconds : undefined, width: typeof meta.width === 'number' ? meta.width : undefined,
    height: typeof meta.height === 'number' ? meta.height : undefined, codec: typeof meta.codec === 'string' ? meta.codec : undefined,
    sceneId: r.scene_id ?? undefined, candidateId: r.candidate_id ?? undefined, depHash: r.dep_hash ?? undefined, version: r.version ?? undefined,
    rejectReason: r.reject_reason ?? undefined, createdAt: iso(r.created_at),
  };
}

/** The stored document holds the user's draft plus server-written approvals/versions; other facts live in tables. */
const serverFactKeys = ['assets', 'status', 'activeJobId', 'lastError', 'qa', 'revision', 'updatedAt'] as const;
export function toDoc(p: Project) {
  const doc: Record<string, unknown> = { ...p };
  for (const k of serverFactKeys) delete doc[k];
  return doc;
}

export async function loadProject(q: Queryable, ctx: Pick<Ctx, 'workspaceId'>, id: string, forUpdate = false): Promise<Project> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, 'Project not found.', 'not_found');
  const [row] = await q.query<{ doc: Record<string, unknown>; revision: number; updated_at: Date }>(
    `select doc, revision, updated_at from public.projects where id = $1 and workspace_id = $2 and deleted_at is null${forUpdate ? ' for update' : ''}`, [id, ctx.workspaceId]);
  if (!row) throw new HttpError(404, 'Project not found.', 'not_found');
  const assets = (await q.query<AssetRow>('select * from public.assets where project_id = $1 and workspace_id = $2 order by created_at desc limit 400', [id, ctx.workspaceId])).map(rowToAsset).reverse();
  const [job] = await q.query<{ id: string; kind: string; status: string; error: string | null }>('select id, kind, status, error from public.jobs where project_id = $1 and workspace_id = $2 order by created_at desc limit 1', [id, ctx.workspaceId]);
  const base = projectSchema.parse({ ...row.doc, id, revision: row.revision, updatedAt: iso(row.updated_at), assets, status: 'draft', qa: null, activeJobId: undefined, lastError: undefined });
  const exp = currentExport(base);
  let qa: Project['qa'] = null;
  if (exp) {
    const [r] = await q.query<{ decision: 'pending' | 'approved' | 'rejected'; note: string | null; created_at: Date }>('select decision, note, created_at from public.qa_reviews where export_asset_id = $1 order by created_at desc limit 1', [exp.id]);
    qa = { exportAssetId: exp.id, decision: r?.decision ?? 'pending', note: r?.note ?? undefined, at: iso(r?.created_at ?? new Date()) };
  }
  let status: Project['status'] = 'draft', activeJobId: string | undefined, lastError: string | undefined;
  if (job && ['queued', 'submitted', 'running'].includes(job.status)) { status = job.kind === 'analysis' ? 'analyzing' : 'generating'; activeJobId = job.id; }
  else if (exp) status = qa?.decision === 'approved' ? 'ready' : 'review';
  else if (job?.status === 'failed') { status = 'failed'; lastError = job.error ?? undefined; }
  else if (job?.status === 'review') status = 'review';
  return { ...base, qa, status, activeJobId, lastError };
}

export async function listProjects(q: Queryable, ctx: Ctx): Promise<Project[]> {
  const rows = await q.query<{ id: string }>('select id from public.projects where workspace_id = $1 and deleted_at is null order by updated_at desc limit 100', [ctx.workspaceId]);
  return Promise.all(rows.map(r => loadProject(q, ctx, r.id)));
}

export async function createProject(q: Queryable, ctx: Ctx, name: string): Promise<Project> {
  const p = newProject(name);
  await q.query('insert into public.projects(id, workspace_id, doc, created_by) values ($1, $2, $3, $4)', [p.id, ctx.workspaceId, toDoc(p), ctx.userId]);
  return loadProject(q, ctx, p.id);
}

async function writeDoc(q: Queryable, ctx: Ctx, p: Project) {
  await q.query('update public.projects set doc = $1, revision = revision + 1, updated_at = now() where id = $2 and workspace_id = $3', [toDoc(p), p.id, ctx.workspaceId]);
}

/** Optimistic concurrency: the caller states the revision it edited; a mismatch returns 409 instead of overwriting. */
export async function saveProject(q: Queryable, ctx: Ctx, id: string, incoming: unknown, expectedRevision: number): Promise<Project> {
  const stored = await loadProject(q, ctx, id, true);
  if (stored.revision !== expectedRevision) throw new HttpError(409, new ConflictError().message, 'conflict');
  const merged = domain(() => mergeClientEdits(stored, incoming, { requireSheets: true }));
  await writeDoc(q, ctx, merged);
  return loadProject(q, ctx, id);
}

export async function approve(q: Queryable, ctx: Ctx, projectId: string, sceneId: string, frameAssetId: string): Promise<Project> {
  const stored = await loadProject(q, ctx, projectId, true);
  const next = domain(() => approveScene(stored, sceneId, frameAssetId));
  await writeDoc(q, ctx, next);
  return loadProject(q, ctx, projectId);
}

/** Server-side mutation used by the analysis job (roles/candidates are recomputed by the domain rules). */
export async function writeProjectFacts(q: Queryable, ctx: Pick<Ctx, 'workspaceId'>, p: Project) {
  await q.query('update public.projects set doc = $1, revision = revision + 1, updated_at = now() where id = $2 and workspace_id = $3', [toDoc(p), p.id, ctx.workspaceId]);
}

export async function softDeleteProject(q: Queryable, ctx: Ctx, id: string) {
  const rows = await q.query('update public.projects set deleted_at = now() where id = $1 and workspace_id = $2 and deleted_at is null returning id', [id, ctx.workspaceId]);
  if (!rows.length) throw new HttpError(404, 'Project not found.', 'not_found');
}

// ---------------------------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------------------------
export async function loadWallet(q: Queryable, workspaceId: string, limit = 50): Promise<Wallet> {
  const [w] = await q.query<{ available: string; held: string; spent: string }>('select available, held, spent from public.wallets where workspace_id = $1', [workspaceId]);
  const ops = await q.query<{ operation_id: string; kind: Wallet['operations'][number]['kind']; amount: string; created_at: Date; note: string | null }>('select operation_id, kind, amount, created_at, note from public.ledger_entries where workspace_id = $1 order by id desc limit $2', [workspaceId, limit]);
  return { available: Number(w?.available ?? 0), held: Number(w?.held ?? 0), spent: Number(w?.spent ?? 0), operations: ops.map(o => ({ id: o.operation_id, kind: o.kind, amount: Number(o.amount), at: iso(o.created_at), note: o.note ?? undefined })) };
}

const ledgerErrors: Record<string, [number, string]> = {
  insufficient_credits: [402, 'Insufficient credits. Add credits to continue.'],
  operation_conflict: [409, 'This operation was already recorded with different details.'],
  no_reservation: [409, 'No matching credit reservation.'],
};
async function ledgerCall(q: Queryable, sql: string, params: unknown[]) {
  try { await q.query(sql, params); } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    for (const [k, [status, text]] of Object.entries(ledgerErrors)) if (msg.includes(k)) throw new HttpError(status, text, k);
    throw e;
  }
}
export const reserveCredits = (q: Queryable, workspaceId: string, operationId: string, amount: number, jobId: string) => ledgerCall(q, 'select public.wallet_reserve($1, $2, $3, $4)', [workspaceId, operationId, amount, jobId]);
export const finalizeCredits = (q: Queryable, workspaceId: string, operationId: string, settle: number) => ledgerCall(q, 'select public.wallet_finalize($1, $2, $3)', [workspaceId, operationId, settle]);
