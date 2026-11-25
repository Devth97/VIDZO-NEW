import type { PoolConfig } from 'pg';
import { SUPABASE_CA_CERT } from './supabase-ca';

/** Keep certificate verification enabled even when a copied URI contains sslmode=require. */
export function databaseConnectionOptions(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const supabase = url.hostname.endsWith('.pooler.supabase.com') || /^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname);
  // pg otherwise replaces the explicit TLS options with connection-string parameters.
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(key);
  return {
    connectionString: url.toString(), max: 5, connectionTimeoutMillis: 10_000,
    ssl: loopback ? undefined : { rejectUnauthorized: true, ...(supabase ? { ca: SUPABASE_CA_CERT } : {}) },
  };
}
