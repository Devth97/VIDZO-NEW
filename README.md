# VIDZO

Reference-to-original advertising studio for brands and agencies: turn an authorized reference concept into a distinct 10–15 s vertical ad with your real product, exact logo and original characters, approving every frame before spending.

**Status: beta deployment.** The app is published on [Cloudflare Workers](https://vidzo-studio.promptpacktech.workers.dev), and the hosted Supabase database is provisioned. Custom-domain activation and a complete Google login still need verification. Real AI providers, private media storage, payments and media assembly remain disabled until configured. See [handoff/VERIFICATION.md](handoff/VERIFICATION.md) for exactly what was tested, [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for the architecture and [deployment setup](docs/DEPLOYMENT.md) for hosting, secrets and DNS.

## Run

Requires Node.js 24 and pnpm 11 (`corepack pnpm …` works if pnpm isn't on PATH).

```powershell
pnpm install --frozen-lockfile
pnpm dev          # explore mode: browser-only, simulated, http://127.0.0.1:3000
pnpm dev:local    # local test backend: real DB/storage/ledger on this machine, simulated providers, http://127.0.0.1:3001
```

In local mode, sign in with any email: the sign-in link appears on screen and in the console. `admin@example.test` gets the admin role. Data lives in `.data/` (git-ignored); delete that folder to reset. Only one `next dev` can run per checkout.

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Live mode (`VIDZO_MODE=live`) needs the variables in [.env.example](.env.example); each capability stays disabled until configured. Apply `supabase/migrations` to the Supabase project. Never apply `supabase/local`.

Live sign-in uses **Continue with Google through Supabase**. Follow [Google sign-in setup](docs/GOOGLE_SIGN_IN.md) to configure the provider and callback URLs. Sign-in does not require an email sender. The Google client secret belongs in Supabase's provider settings, never in the repository.

Never commit secrets, customer media, `.data/`, dependencies or build output.
