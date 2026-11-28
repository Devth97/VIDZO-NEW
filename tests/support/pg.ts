// Real PostgreSQL for the server suite when VIDZO_TEST_PG_URL is set (CI runs a postgres service).
// Each run gets a fresh database with the same migrations PGlite and Supabase use, and a connection pool,
// so "concurrent" tests really run on separate backends.
import pg from 'pg';
import { migrate, type Db, type Queryable } from '@/lib/server/db';

const wrap = (c: pg.Pool | pg.PoolClient): Queryable => ({ query: async <T,>(text: string, params?: unknown[]) => (await c.query(text, params)).rows as T[] });

export async function createPgTestDb(url: string): Promise<Db> {
  const name = `vidzo_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  try { await admin.query(`create database ${name}`); } finally { await admin.end(); }
  const target = new URL(url);
  target.pathname = '/' + name;
  const pool = new pg.Pool({ connectionString: target.toString(), max: 24 });
  const c = await pool.connect();
  try {
    await migrate({ exec: sql => c.query(sql), query: (sql, p) => c.query(sql, p as unknown[]) });
  } finally { c.release(); }
  return {
    ...wrap(pool),
    tx: async <T,>(fn: (q: Queryable) => Promise<T>) => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn(wrap(client));
        await client.query('commit');
        return result;
      } catch (e) {
        await client.query('rollback').catch(() => undefined);
        throw e;
      } finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
