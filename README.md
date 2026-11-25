# VIDZO

Reference-to-original advertising studio for brands and agencies: turn an authorized reference concept into a distinct 10–15 s vertical ad with your real product, exact logo and original characters, approving every frame before spending.

**Status: beta codebase, not deployed.** The web app, backend APIs, database schema, credit ledger, payment verification, admin review and the full creation flow are implemented and tested locally. Real AI providers, payments, email and hosting are **not connected yet**: they need service accounts. See [handoff/VERIFICATION.md](handoff/VERIFICATION.md) for exactly what was tested, and [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for the architecture.

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

Never commit secrets, customer media, `.data/`, dependencies or build output.
