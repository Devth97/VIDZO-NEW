import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataDir, live, localSecret, mode } from './config';
import { HttpError } from './errors';

/**
 * Private object storage. Keys are always `workspaceId/projectId/assetId` (UUIDs) and never reach the browser;
 * clients receive short-lived signed URLs only.
 */
export interface Storage {
  signPut(key: string, mime: string, bytes: number, ttlSeconds?: number): Promise<{ url: string; headers: Record<string, string> }>;
  signGet(key: string, opts?: { ttlSeconds?: number; downloadName?: string; mime?: string }): Promise<string>;
  readRange(key: string, offset: number, length: number): Promise<Uint8Array>;
  size(key: string): Promise<number | null>;
  write(key: string, body: Uint8Array, mime: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const keyPattern = new RegExp(`^${uuid}/${uuid}/${uuid}$`);
export const objectKey = (workspaceId: string, projectId: string, assetId: string) => {
  const key = `${workspaceId}/${projectId}/${assetId}`;
  if (!keyPattern.test(key)) throw new Error('Invalid object key.');
  return key;
};
const assertKey = (key: string) => { if (!keyPattern.test(key)) throw new Error('Invalid object key.'); };

// ---------------------------------------------------------------------------------------------
// Local test backend: files under .data/objects, HMAC-signed expiring URLs served by /api/storage/local
// ---------------------------------------------------------------------------------------------

export type LocalGrant = { key: string; method: 'PUT' | 'GET'; exp: number; mime?: string; bytes?: number; download?: string };
const b64 = (s: string) => Buffer.from(s).toString('base64url');
export function signLocalGrant(grant: LocalGrant): string {
  const payload = b64(JSON.stringify(grant));
  return payload + '.' + createHmac('sha256', localSecret()).update(payload).digest('base64url');
}
export function verifyLocalGrant(token: string, method: 'PUT' | 'GET', now = Date.now()): LocalGrant {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) throw new HttpError(403, 'Invalid link.');
  const expected = createHmac('sha256', localSecret()).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(403, 'Invalid link.');
  const grant = JSON.parse(Buffer.from(payload, 'base64url').toString()) as LocalGrant;
  if (grant.method !== method) throw new HttpError(403, 'Invalid link.');
  if (now > grant.exp) throw new HttpError(403, 'This link expired. Refresh the page.');
  assertKey(grant.key);
  return grant;
}

const localPath = (key: string) => { assertKey(key); return path.join(dataDir(), 'objects', ...key.split('/')); };

const localStorage: Storage = {
  async signPut(key, mime, bytes, ttl = 600) { assertKey(key); return { url: '/api/storage/local?token=' + signLocalGrant({ key, method: 'PUT', exp: Date.now() + ttl * 1000, mime, bytes }), headers: { 'Content-Type': mime } }; },
  async signGet(key, opts = {}) { assertKey(key); return '/api/storage/local?token=' + signLocalGrant({ key, method: 'GET', exp: Date.now() + (opts.ttlSeconds ?? 300) * 1000, mime: opts.mime, download: opts.downloadName }); },
  async readRange(key, offset, length) {
    const fh = await open(localPath(key), 'r');
    try { const buf = Buffer.alloc(length); const { bytesRead } = await fh.read(buf, 0, length, offset); return new Uint8Array(buf.subarray(0, bytesRead)); } finally { await fh.close(); }
  },
  async size(key) { try { return (await stat(localPath(key))).size; } catch { return null; } },
  async write(key, body) { const p = localPath(key); await mkdir(path.dirname(p), { recursive: true }); await writeFile(p, body, { flag: 'wx' }); },
  async remove(key) { await rm(localPath(key), { force: true }); },
};
export const readLocalObject = (key: string) => readFile(localPath(key));
export const localObjectPath = localPath;

// ---------------------------------------------------------------------------------------------
// Cloudflare R2 (S3 API). Bucket must be private, with CORS limited to APP_ORIGIN for PUT/GET.
// ---------------------------------------------------------------------------------------------

async function r2Storage(): Promise<Storage> {
  const cfg = live.r2();
  if (!cfg) throw new HttpError(503, 'Private file storage is not configured yet.', 'not_configured');
  const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const client = new S3Client({ region: 'auto', endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } });
  const Bucket = cfg.bucket;
  return {
    async signPut(key, mime, bytes, ttl = 600) {
      assertKey(key);
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: mime, ContentLength: bytes }), { expiresIn: ttl, signableHeaders: new Set(['content-type', 'content-length']) });
      return { url, headers: { 'Content-Type': mime } };
    },
    async signGet(key, opts = {}) {
      assertKey(key);
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key, ResponseContentType: opts.mime, ResponseContentDisposition: opts.downloadName ? `attachment; filename="${opts.downloadName.replace(/[^\w.-]/g, '_')}"` : 'inline' }), { expiresIn: opts.ttlSeconds ?? 300 });
    },
    async readRange(key, offset, length) {
      assertKey(key);
      const r = await client.send(new GetObjectCommand({ Bucket, Key: key, Range: `bytes=${offset}-${offset + length - 1}` }));
      return new Uint8Array(await r.Body!.transformToByteArray());
    },
    async size(key) {
      assertKey(key);
      try { return Number((await client.send(new HeadObjectCommand({ Bucket, Key: key }))).ContentLength ?? 0); } catch { return null; }
    },
    async write(key, body, mime) { assertKey(key); await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: mime, IfNoneMatch: '*' })); },
    async remove(key) { assertKey(key); await client.send(new DeleteObjectCommand({ Bucket, Key: key })); },
  };
}

let r2: Promise<Storage> | undefined;
let testStorage: Storage | undefined;
export function setTestStorage(s: Storage | undefined) { testStorage = s; }
export async function getStorage(): Promise<Storage> {
  if (testStorage) return testStorage;
  if (mode() === 'local') return localStorage;
  if (mode() === 'live') return (r2 ??= r2Storage().catch(e => { r2 = undefined; throw e; }));
  throw new HttpError(404, 'Server storage is not available in demo mode.', 'demo_mode');
}

/** In-memory storage for tests. */
export function memoryStorage(): Storage & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    async signPut(key, mime) { assertKey(key); return { url: 'memory://put/' + key, headers: { 'Content-Type': mime } }; },
    async signGet(key) { assertKey(key); return 'memory://get/' + key; },
    async readRange(key, offset, length) { const o = objects.get(key); if (!o) throw new Error('missing'); return o.subarray(offset, offset + length); },
    async size(key) { return objects.get(key)?.length ?? null; },
    async write(key, body) { assertKey(key); if (objects.has(key)) throw new Error('exists'); objects.set(key, body); },
    async remove(key) { objects.delete(key); },
  };
}
