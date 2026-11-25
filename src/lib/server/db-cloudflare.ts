import { env } from 'cloudflare:workers';
import { Client } from 'pg';
import type { Db, Queryable } from './db';
import { HttpError } from './errors';

// Vite selects this implementation only for Cloudflare. Never keep sockets or
// clients across Worker requests; Hyperdrive owns the upstream connection pool.
export const cacheHostedDb = false;

export async function createHostedDb(): Promise<Db> {
  const binding = env.HYPERDRIVE;
  if (!binding) throw new HttpError(503, 'The workspace database is not configured yet.', 'not_configured');
  const withClient = async <T,>(fn: (q: Queryable) => Promise<T>) => {
    const client = new Client({ connectionString: binding.connectionString, connectionTimeoutMillis: 10_000 });
    try {
      await client.connect();
      return await fn({ query: async <R,>(text: string, params?: unknown[]) => (await client.query(text, params)).rows as R[] });
    } finally { await client.end().catch(() => undefined); }
  };
  return {
    query: <T,>(text: string, params?: unknown[]) => withClient(q => q.query<T>(text, params)),
    tx: <T,>(fn: (q: Queryable) => Promise<T>) => withClient(async q => {
      await q.query('begin');
      try {
        const result = await fn(q);
        await q.query('commit');
        return result;
      } catch (e) { await q.query('rollback').catch(() => undefined); throw e; }
    }),
  };
}
