import 'server-only';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { dataDir, live, mode } from './config';
import { HttpError } from './errors';
import { createHostedDb, cacheHostedDb } from './db-hosted';

export interface Queryable { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> }
export interface Db extends Queryable { tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>; close?(): Promise<void> }

/** Applies the local auth stub and every Supabase migration, in order, recording what ran. */
export async function migrate(db: { exec(sql: string): Promise<unknown>; query(sql: string, p?: unknown[]): Promise<{ rows: unknown[] }> }) {
  await db.exec('create table if not exists public._vidzo_migrations (name text primary key, applied_at timestamptz not null default now())');
  const root = process.cwd();
  const files = [
    ...readdirSync(path.join(root, 'supabase/local')).filter(f => f.endsWith('.sql')).sort().map(f => ['local/' + f, path.join(root, 'supabase/local', f)]),
    ...readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort().map(f => ['migrations/' + f, path.join(root, 'supabase/migrations', f)]),
  ];
  for (const [name, file] of files) {
    const done = await db.query('select 1 from public._vidzo_migrations where name = $1', [name]);
    if (done.rows.length) continue;
    await db.exec('begin;\n' + readFileSync(file, 'utf8') + `\ninsert into public._vidzo_migrations(name) values ('${name.replace(/'/g, "''")}');\ncommit;`);
  }
}

/** Embedded Postgres for the local test backend and for tests (in-memory when dir is undefined). */
export async function createPgliteDb(dir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dir) mkdirSync(dir, { recursive: true });
  const pg = await PGlite.create(dir ? { dataDir: dir } : undefined);
  await migrate(pg);
  const wrap = (q: { query: typeof pg.query }): Queryable => ({ query: async <T,>(text: string, params?: unknown[]) => (await q.query<T>(text, params as never[])).rows });
  // PGlite is a single connection; serialize transactions so they cannot interleave statements.
  let chain: Promise<unknown> = Promise.resolve();
  return {
    ...wrap(pg),
    tx: <T,>(fn: (q: Queryable) => Promise<T>) => {
      const run = chain.then(() => pg.transaction(tx => fn(wrap(tx))));
      chain = run.catch(() => undefined);
      return run as Promise<T>;
    },
    close: () => pg.close(),
  };
}

const g = globalThis as unknown as { __vidzoDb?: Promise<Db>; __vidzoTestDb?: Db };

/** Tests inject an in-memory database here. */
export function setTestDb(db: Db | undefined) { g.__vidzoTestDb = db; }

export async function getDb(): Promise<Db> {
  if (g.__vidzoTestDb) return g.__vidzoTestDb;
  const m = mode();
  if (m === 'local') {
    if (!g.__vidzoDb) void import('./jobs').then(j => j.startLocalRunner()); // local has no cron; jobs keep running after a restart
    return (g.__vidzoDb ??= createPgliteDb(path.join(dataDir(), 'pglite')));
  }
  if (m === 'live') {
    if (!cacheHostedDb) return createHostedDb(live.databaseUrl());
    return (g.__vidzoDb ??= createHostedDb(live.databaseUrl()));
  }
  throw new HttpError(404, 'Server workspaces are not available in demo mode.', 'demo_mode');
}
