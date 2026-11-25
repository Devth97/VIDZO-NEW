import 'server-only';
import { z } from 'zod';
import { imageMimes, uploadKinds, videoMimes, type Asset, type Project } from '@/lib/domain/schema';
import { referenceLimits } from '@/lib/domain/project';
import type { Ctx } from './auth';
import type { Queryable } from './db';
import { HttpError } from './errors';
import { probeVideo, referenceProblem, sniffImage } from './media';
import { loadProject, rowToAsset } from './repo';
import { getStorage, objectKey } from './storage';

export const signInput = z.object({
  projectId: z.uuid(), kind: z.enum(uploadKinds), name: z.string().trim().min(1).max(200),
  mime: z.enum([...videoMimes, ...imageMimes]), bytes: z.number().int().positive(),
});

const MAX_UPLOADS_PER_PROJECT = 40;

export async function signUpload(q: Queryable, ctx: Ctx, raw: unknown) {
  const input = signInput.parse(raw);
  const isVideo = (videoMimes as readonly string[]).includes(input.mime);
  if ((input.kind === 'reference') !== isVideo) throw new HttpError(400, input.kind === 'reference' ? 'Use an MP4 or MOV video.' : 'Use PNG, JPEG or WebP images.', 'invalid_type');
  if (input.bytes > (isVideo ? referenceLimits.maxBytes : referenceLimits.imageMaxBytes)) throw new HttpError(400, isVideo ? 'Your file exceeds the 100 MB limit.' : 'Brand images must be 10 MB or smaller.', 'too_large');
  const project = await loadProject(q, ctx, input.projectId);
  if (input.kind === 'reference' && !project.rights) throw new HttpError(400, 'Confirm your rights before uploading a reference.', 'rights_required');
  const [{ n }] = await q.query<{ n: string }>("select count(*) n from public.assets where project_id = $1 and kind in ('reference', 'product', 'logo')", [project.id]);
  if (Number(n) >= MAX_UPLOADS_PER_PROJECT) throw new HttpError(400, 'This project has reached its upload limit.', 'limit');
  const id = crypto.randomUUID();
  const key = objectKey(ctx.workspaceId, project.id, id);
  const name = input.name.replace(/[^\w .()-]/g, '_').slice(0, 200);
  const [row] = await q.query('insert into public.assets(id, workspace_id, project_id, kind, name, mime, bytes, object_key, status, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8, \'pending\', $9) returning *', [id, ctx.workspaceId, project.id, input.kind, name, input.mime, input.bytes, key, ctx.userId]);
  const upload = await (await getStorage()).signPut(key, input.mime, input.bytes);
  return { asset: rowToAsset(row as never), upload };
}

/** Verifies uploaded bytes. Invalid media is rejected and deleted; nothing is ever charged for it. */
export async function completeUpload(q: Queryable, ctx: Ctx, assetId: string): Promise<Asset> {
  const [row] = await q.query<Record<string, unknown> & { object_key: string; bytes: string; mime: string; kind: string; status: string }>('select * from public.assets where id = $1 and workspace_id = $2 for update', [assetId, ctx.workspaceId]);
  if (!row) throw new HttpError(404, 'File not found.', 'not_found');
  if (row.status !== 'pending') return rowToAsset(row as never);
  const storage = await getStorage();
  const reject = async (reason: string) => {
    await storage.remove(row.object_key).catch(() => undefined);
    const [r] = await q.query("update public.assets set status = 'rejected', reject_reason = $2 where id = $1 returning *", [assetId, reason]);
    return rowToAsset(r as never);
  };
  const size = await storage.size(row.object_key);
  if (size === null) throw new HttpError(409, 'The upload has not arrived yet. Try again.', 'not_uploaded');
  if (size !== Number(row.bytes)) return reject('The uploaded size does not match the selected file.');
  const read = (offset: number, length: number) => storage.readRange(row.object_key, offset, length);
  let meta: Record<string, unknown>;
  try {
    if (row.kind === 'reference') {
      const info = await probeVideo(read, size);
      const problem = referenceProblem(info, row.mime);
      if (problem) return reject(problem);
      meta = { seconds: Math.round(info.seconds * 100) / 100, codec: info.tracks.find(t => t.handler === 'vide')?.codec, container: info.brand.trim(), audio: info.tracks.some(t => t.handler === 'soun') };
    } else {
      const img = sniffImage(await read(0, 65_536));
      if (!img || img.mime !== row.mime) return reject('The file is not a valid PNG, JPEG or WebP image.');
      if (img.width < 64 || img.height < 64 || img.width > 12_000 || img.height > 12_000) return reject('Image dimensions must be between 64 and 12,000 pixels.');
      meta = { width: img.width, height: img.height };
    }
  } catch (e) {
    return reject(e instanceof Error && e.message.length < 120 ? e.message : 'The file could not be read.');
  }
  const [r] = await q.query("update public.assets set status = 'verified', meta = $2, verified_at = now() where id = $1 returning *", [assetId, meta]);
  return rowToAsset(r as never);
}

/** Short-lived signed URL for a verified asset in the caller's workspace. Export downloads need human QA approval. */
export async function assetUrl(q: Queryable, ctx: Ctx, assetId: string, download: boolean) {
  const [row] = await q.query<{ object_key: string; mime: string; name: string; kind: string; status: string; project_id: string; placeholder: boolean }>('select object_key, mime, name, kind, status, project_id, placeholder from public.assets where id = $1 and workspace_id = $2', [assetId, ctx.workspaceId]);
  if (!row || row.status === 'rejected') throw new HttpError(404, 'File not found.', 'not_found');
  if (row.status !== 'verified' && !(row.status === 'pending' && row.kind === 'reference')) throw new HttpError(409, 'This file is still being verified.', 'pending');
  if (download && row.kind === 'export') {
    const [qa] = await q.query<{ decision: string }>('select decision from public.qa_reviews where export_asset_id = $1 order by created_at desc limit 1', [assetId]);
    if (qa?.decision !== 'approved') throw new HttpError(403, 'This export is waiting for quality review before download.', 'qa_pending');
  }
  const url = await (await getStorage()).signGet(row.object_key, { mime: row.mime, downloadName: download ? row.name : undefined });
  return { url, placeholder: row.placeholder, mime: row.mime };
}

/** Stores a server-produced output as an immutable verified asset after checking its actual bytes. */
export async function storeOutput(q: Queryable, ws: string, project: Pick<Project, 'id'>, out: { kind: Asset['kind']; name: string; mime: string; bytes: Uint8Array; placeholder: boolean; sceneId?: string; candidateId?: string; depHash: string; version?: number; jobId: string; meta?: Record<string, unknown> }): Promise<string> {
  let meta = out.meta ?? {};
  if (out.mime === 'video/mp4') {
    const { fromBuffer } = await import('./media');
    const info = await probeVideo(fromBuffer(out.bytes), out.bytes.length);
    if (!info.tracks.some(t => t.handler === 'vide')) throw new Error('Provider output has no video track.');
    meta = { ...meta, seconds: info.seconds, codec: info.tracks.find(t => t.handler === 'vide')?.codec };
  } else if (out.mime === 'image/png' || out.mime === 'image/jpeg' || out.mime === 'image/webp') {
    const img = sniffImage(out.bytes.subarray(0, 65_536));
    if (!img) throw new Error('Provider output is not a valid image.');
    meta = { ...meta, width: img.width, height: img.height };
    out = { ...out, mime: img.mime };
  } else if (!out.placeholder) {
    throw new Error('Only placeholder outputs may use SVG or JSON.');
  }
  const id = crypto.randomUUID();
  const key = objectKey(ws, project.id, id);
  await (await getStorage()).write(key, out.bytes, out.mime);
  await q.query("insert into public.assets(id, workspace_id, project_id, kind, name, mime, bytes, object_key, status, placeholder, meta, scene_id, candidate_id, dep_hash, version, job_id, verified_at) values ($1,$2,$3,$4,$5,$6,$7,$8,'verified',$9,$10,$11,$12,$13,$14,$15, now())",
    [id, ws, project.id, out.kind, out.name, out.mime, out.bytes.length, key, out.placeholder, meta, out.sceneId ?? null, out.candidateId ?? null, out.depHash, out.version ?? null, out.jobId]);
  return id;
}
