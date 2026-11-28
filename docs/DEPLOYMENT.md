# VIDZO hosting and Supabase

## Current deployment

- App: `https://vidzo-studio.promptpacktech.workers.dev` on the owner's personal Cloudflare account.
- Production origin: `https://vidzo.tech`; its personal-account DNS zone is active. HTTPS and the database readiness endpoint were verified on 25 November 2026.
- Supabase project: `vidzoauth` (`pehaquzsqeiocjirogei`), with 15 application tables and RLS enabled on all of them.
- Mode: `live`. Unconfigured storage, AI, payments, pricing and assembly fail closed; this deployment does not enable simulated paid services.
- Basic Cloudflare setup selected by the owner: no shared response/data cache and no Cloudflare image optimization.

The Worker uses vinext alongside the existing Next.js setup. Node/Next commands still work; the Cloudflare wrapper disables Node standalone output only for the Workers build. Worker types use a separate TypeScript configuration to avoid replacing browser types in the Next.js project.

## Deployment through GitHub

`.github/workflows/deploy.yml` verifies types, unit/integration tests, the production dependency audit, the Next.js build and the Workers build. Pushes to `main` deploy only after verification; pull requests verify without deployment secrets. After deployment, the workflow checks `/api/health`, which executes a database readiness query and returns no identifiers or credentials. The Worker also carries a one-minute Cron Trigger (`cloudflare.config.ts`) that runs the background job sweep; `/api/health` reports `runnerAgeSeconds`, which should stay under about 120 once the cron is live. If it is `null` or keeps growing, check the Worker's Triggers tab in the dashboard.

GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`: account-owned token scoped to Workers script deployment and Hyperdrive read access on the personal account, expiring 25 November 2027. Renew before expiry.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key.

The Supabase publishable key is uploaded through an ignored JSON file. The database password is held by Hyperdrive and is not required by GitHub or the app Worker. The account ID is pinned in `cloudflare.config.ts`. Local deployments remove inherited company API credentials and explicitly select the `vidzo-personal` OAuth profile. CI uses the dedicated repository token.

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build:vinext
pnpm typecheck:cloudflare
pnpm deploy:vinext --dry-run
```

Local deployment requires the ignored `.env.local` file with `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Node-based live development additionally uses `DATABASE_URL`. Never commit this file, `.data/`, `.cloudflare/`, generated output, customer media or API credentials.

## Database migrations and TLS

The initial migration and `20261125010000_hosted_permissions.sql` were applied to the hosted project. Hosted migration versions match the source filenames. Never apply `supabase/local`; it only supplies the embedded test database's auth schema and roles.

Supabase's hosted default privileges grant function execution explicitly to `anon` and `authenticated`. The follow-up migration revokes those grants from the three credit/payment mutation functions, in addition to PUBLIC. It also pins trigger search paths and improves two RLS predicates. Local tests reproduce the hosted default grants so this difference stays covered.

The signed-in `is_member` helper intentionally remains callable for tenant-read policies. The three operational tables with no client policies intentionally deny browser access. Those informational/intentional advisor findings are not reasons to grant browser access to admin data.

Database TLS verifies certificates and hostnames. The official public Supabase CA is bundled in `src/lib/server/supabase-ca.ts`; it is a public trust anchor, not a private key. Connection-string TLS parameters cannot override verification. The certificate fingerprint is `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`, expiring 26 April 2031. Obtain rotations from the official Supabase dashboard/source, never from the unverified server being connected to.

Cloudflare uses the `vidzo-supabase` Hyperdrive configuration (`1cb835e255244016b66acd64f1da19ca`) with the official CA uploaded, `verify-full`, query caching disabled and a five-connection origin limit. It connects to the project's direct Postgres endpoint. The free Hyperdrive allowance applies; no paid plan was activated. Workers cannot use the Node driver's custom-CA path directly, so Vite selects `db-cloudflare.ts` in place of the Node hosted implementation. Each operation gets a fresh client, and transactions retain one client until commit/rollback; no sockets are reused across Worker requests. Hyperdrive owns the upstream pool. Local Cloudflare development explicitly uses the remote binding and therefore the live database; `pnpm dev:local` remains the isolated simulated test backend.

## Custom domain and nameservers

The domain now uses the personal account's free zone, assigned:

```text
art.ns.cloudflare.com
tegan.ns.cloudflare.com
```

The earlier `ace.ns.cloudflare.com` / `ollie.ns.cloudflare.com` zone belongs to a different account. Cloudflare's moved-zone email for that account is expected and is not an instruction to restore the old nameservers. The new zone was confirmed active under promptpacktech@gmail.com and `https://vidzo.tech/api/health` returned `status: ok`. The custom domain was connected through the dashboard/browser flow; future deployments must preserve that attachment. Keep email and verification records in the active Cloudflare zone, not Hostinger's inactive DNS editor.

Supabase's Site URL and redirect allow list are already set by the owner for `https://vidzo.tech`. Keep `APP_ORIGIN` aligned with that origin. The workers.dev address is useful for checking the site, but a complete Google login redirects to the production origin. Do not claim an end-to-end Google login has passed until DNS/domain activation and an actual sign-in succeed.

## Rollback

Redeploy the prior known-good Cloudflare Worker version or revert the relevant Git commit and push `main`. Preserve the Supabase schema and data during application rollback; do not reset the database. If readiness fails after deploy, inspect the failing GitHub run and Cloudflare logs without copying credentials into logs or chat. AI generation, payments, R2 uploads, background orchestration and FFmpeg assembly remain separate release gates.
