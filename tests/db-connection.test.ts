import { describe, expect, it } from 'vitest';
import { databaseConnectionOptions } from '@/lib/server/db-connection';

describe('hosted database TLS', () => {
  it('trusts the official Supabase CA while requiring certificate verification', () => {
    const config = databaseConnectionOptions('postgresql://postgres.project:test@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require');
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true, ca: expect.stringContaining('BEGIN CERTIFICATE') });
    expect(config.connectionString).not.toContain('sslmode');
  });
  it('cannot disable TLS with URL parameters or a hostname containing localhost', () => {
    const config = databaseConnectionOptions('postgresql://user:test@localhost.attacker.test/postgres?sslmode=disable&ssl=false');
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.connectionString).not.toContain('ssl=');
  });
  it('only allows plaintext for actual loopback development connections', () => {
    expect(databaseConnectionOptions('postgresql://user:test@127.0.0.1/postgres').ssl).toBeUndefined();
    expect(databaseConnectionOptions('postgresql://user:test@localhost/postgres').ssl).toBeUndefined();
  });
});
