// Keep VIDZO deployments on the owner's personal Cloudflare account even when
// this machine has unrelated company credentials in its global environment.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env };
const ci = process.env.GITHUB_ACTIONS === 'true';
for (const key of ['CLOUDFLARE_API_KEY', 'CLOUDFLARE_EMAIL', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_ZONE_ID']) delete env[key];
if (!ci) delete env.CLOUDFLARE_API_TOKEN;
env.CLOUDFLARE_ACCOUNT_ID = 'a18166538751152974d6594a321c30ef';
env.VIDZO_PLATFORM = 'cloudflare';

const [action, ...args] = process.argv.slice(2);
const run = (file, args, stdio = 'inherit') => spawnSync(process.execPath, [fileURLToPath(new URL(file, import.meta.url)), ...args], { cwd: root, env, stdio });
if (action === 'deploy') {
  const values = ci ? process.env : parseEnv(readFileSync(new URL('../.env.local', import.meta.url), 'utf8'));
  if (!values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('Supabase publishable key is missing from .env.local.');
  if (ci && !env.CLOUDFLARE_API_TOKEN) throw new Error('The dedicated GitHub deployment token is missing.');
  if (!ci) {
    const activation = run('../node_modules/cf/bin/cf', ['auth', 'activate', 'vidzo-personal']);
    if (activation.status !== 0) process.exit(activation.status ?? 1);
  }
  const build = run('../node_modules/vite/bin/vite.js', ['build']);
  if (build.status !== 0) process.exit(build.status ?? 1);
  // Upload only explicitly named app secrets, never the global environment.
  mkdirSync(new URL('../.data/', import.meta.url), { recursive: true });
  const secretsFile = fileURLToPath(new URL('../.data/cloudflare-secrets.json', import.meta.url));
  const named = ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'MEDIA_WORKER_TOKEN'];
  const missing = named.filter(k => !values[k]);
  if (missing.length) throw new Error(`Missing deployment secrets: ${missing.join(', ')}.`);
  writeFileSync(secretsFile, JSON.stringify(Object.fromEntries(named.map(k => [k, values[k]]))), { mode: 0o600 });
  const result = run('../node_modules/cf/bin/cf', ['deploy', '--prebuilt', ...(!ci ? ['--profile', 'vidzo-personal'] : []), '--secrets-file', secretsFile, ...args]);
  process.exit(result.status ?? 1);
}
if (!['dev', 'build', 'preview'].includes(action)) throw new Error('Expected dev, build, preview or deploy.');
const result = run('../node_modules/vite/bin/vite.js', [action, ...args]);
process.exit(result.status ?? 1);
