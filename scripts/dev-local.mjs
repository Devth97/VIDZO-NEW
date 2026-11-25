// Starts the LOCAL TEST BACKEND: embedded Postgres + disk storage + simulated providers, loopback only.
// Admin access for local testing goes to the address in VIDZO_ADMIN_EMAILS (defaults to a reserved test domain).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const port = process.env.PORT ?? '3001';
const env = { ...process.env, VIDZO_MODE: 'local', VIDZO_ADMIN_EMAILS: process.env.VIDZO_ADMIN_EMAILS ?? 'admin@example.test' };
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', port], { env, stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
