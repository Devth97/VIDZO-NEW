import type { Db, Queryable } from './db';
import { databaseConnectionOptions } from './db-connection';
import { HttpError } from './errors';

export const cacheHostedDb = true;

export async function createHostedDb(url?: string): Promise<Db> {
  if (!url) throw new HttpError(503, 'The workspace database is not configured yet.', 'not_configured');
  const { Pool } = await import('pg');
  const pool = new Pool(databaseConnectionOptions(url));
  return {
    query: async <T,>(text: string, params?: unknown[]) => (await pool.query(text, params)).rows as T[],
    tx: async <T,>(fn: (q: Queryable) => Promise<T>) => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn({ query: async <R,>(text: string, params?: unknown[]) => (await client.query(text, params)).rows as R[] });
        await client.query('commit');
        return result;
      } catch (e) { await client.query('rollback').catch(() => undefined); throw e; } finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
