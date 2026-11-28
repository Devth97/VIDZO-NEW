# VIDZO implementation map

What exists in code as of 25 November 2026. For what has and has not been verified, see `../handoff/VERIFICATION.md`. Design: warm beige `#F7F5F0`, warm white `#FFFEFA`, ink `#282B25`, olive `#445A39` (this overrides the dark palette in the original design document).

## Modes

| Mode | Purpose | Data | Providers / payments |
| --- | --- | --- | --- |
| `demo` (default) | Public explore mode | Browser localStorage + IndexedDB | Simulated in the browser, labelled placeholders, 300 simulated credits |
| `local` (`pnpm dev:local`) | Full-stack testing on this machine | PGlite embedded Postgres + `.data/` disk storage (git-ignored), loopback only | Simulated provider (labelled SVG/JSON placeholders), signed test webhooks |
| `live` | Production | Supabase Postgres + Auth, Cloudflare R2 | Gemini, fal, media worker, Razorpay. Each returns 503 until configured; never falls back to demo or simulated providers |

## Layout

- `src/lib/domain`: pure, isomorphic rules. `schema.ts` (Zod), `project.ts` (dependency hashes, step prerequisites, quotes, wallet model, prompt building, v1 migration), `merge.ts` (server trust boundary for client saves), `pricing.ts` (configuration; placeholder values flagged `illustrative`), `hash.ts`, `sample.ts`, `placeholder.ts`.
- `src/lib/server`: `config` (modes and capabilities), `db` (PGlite/pg + migration runner), `auth` (Supabase SSR sessions; local signed links and session cookie; workspace bootstrap), `repo` (project composition, optimistic concurrency, approvals, wallet), `assets` (signed upload, byte verification, signed GET, QA-gated download, output storage), `media` (MP4/MOV box parser, image sniffing), `storage` (local HMAC URLs, R2 presigner), `jobs` (quotes, job creation, lease-based orchestration, reconciliation, settlement), `payments` (orders, webhook verification), `providers/*` (adapter contract, simulated, fal, Gemini, media worker), `http` (route wrapper, same-origin check).

Live sign-in uses Google through Supabase (`POST /api/auth/google` → PKCE callback). Email links are restricted to the local test backend. See `docs/GOOGLE_SIGN_IN.md` for account ownership, provider settings and verification still needed with real accounts.
- `supabase/migrations`: tables, triggers (immutable assets/job inputs, append-only ledger), `wallet_reserve`, `wallet_finalize`, `payment_capture`, RLS. `supabase/local`: PGlite-only auth stub, never applied to Supabase.
- `src/components`: `backend.ts` (one `Backend` interface; demo and server implementations), `workspace-provider.tsx`, `studio/*` (seven steps, `use-project.ts` save queue, shared media/job components), shell, public frame.
- `src/app`: public pages `/`, `/showcase`, `/pricing`, `/signin`, `/terms`, `/privacy`; workspace `/projects`, `/studio/[id]`, `/assets`, `/characters`, `/wallet`, `/support`, `/admin`; `/auth/callback`; `/api/*`.

## Key rules

- **Dependencies are derived, not flagged.** A frame stores the hash of its scene's prompt, length, roles, visual brief fields, verified product photos and the selected identity sheets. A clip stores that hash plus the approved frame. The export stores the clip ids, overlay fields and the logo. An output is current only while its hash matches, so an edit invalidates exactly what depends on it, and undoing the edit restores earlier work. Analysis text describes the reference and invalidates nothing.
- **Client saves are drafts.** The server merges only editable fields and recomputes scene versions/history. Assets, approvals, status, jobs, QA and analysis provenance are server facts. Saves carry `expectedRevision`; a mismatch returns 409 and the UI asks to reload. The client save queue is serialized and sequence-numbered, flushes before step changes, approvals and spend, and warns before unload.
- **Spend path.** Quote (tasks with dependency hashes, pricing version, expiry) → `POST /api/jobs` with the quote id as idempotency key → server re-derives the quote from current state, checks pause/concurrency/daily cap/circuit breaker, reserves credits atomically, and snapshots immutable job input → attempts submit with a persisted state before each external call. Crash during submit → `unknown` → reconcile by idempotency key; if not found, flag for admin (credits stay held). Transient errors retry at most twice. Completion settles only succeeded items and releases the rest.
- **Payments.** Orders are created server-side from the server pack table. Credits come only from `payment_capture` via an HMAC-verified webhook whose amount and currency match the order; events are deduplicated by id; a capture is idempotent; a late failure cannot undo it.
- **Media.** Uploads go straight to private storage by signed URL, then the server checks the size, magic bytes and container/codec/duration (MP4/MOV `ftyp`/`moov`/`mvhd`/`stsd`) or the image type and dimensions. Rejected files are deleted without charge. Provider result downloads are https-only, exact-host allowlisted, redirect-free and size-capped.

## Quote and review clarity (28 November 2026)

- **Quote review** (`components/studio/quote-review.tsx`): deliverable (duration, 9:16, scene count, 1080 × 1920 30 fps H.264/AAC target), model, native resolution with an upscale disclosure (`upscaleDisclosure`), per-item credits, maximum credits, available/held/after-hold balances, the technical-failure / quality-review / paid-redraw distinction, retry policy and a live expiry countdown. An expired quote, or one that no longer matches a project edited after it arrived (`quoteProblem`), offers only "Get a fresh quote". The server still re-derives every quote before spending.
- **Scenes** carry an optional `purpose` (label only: no invalidation) and `productAction` (generation input: versioned, in the dependency hash and the prompt). Empty optional fields are left out of hashes, so existing approvals survive the schema change.
- **Product fidelity**: `brief.fidelity` (shape, colour, packaging text, prohibited changes) is sent in every frame/clip prompt and shown beside the customer's original product photos in the storyboard. When product photos exist, approving a frame requires ticking that the product matches them; the tick belongs to that frame only. Adding notes invalidates frames made without them.
- **Job states** name each item by scene, explain held/settled/released credits, the unknown-outcome check, review, and technical failure (free retry quote plus support link).

## Durable job runner (28 November 2026)

**Choice: a Cloudflare Cron Trigger on the existing `vidzo-studio` Worker**, calling the existing orchestration (`sweepJobs` → `advanceJob`). Trigger.dev was the original plan; it was not adopted and its unused SDK was removed so there is only one orchestrator.

| | Cloudflare cron (chosen) | Trigger.dev |
| --- | --- | --- |
| New accounts / secrets | None: same Worker, Hyperdrive binding and deploy pipeline | New project, API key, deployed task bundle, and a direct database path (Hyperdrive is Workers-only) |
| Fit with current code | Reuses leases, attempts, reconciliation and ledger as-is | Would need the job state machine moved into tasks, or a second orchestrator beside it |
| Operating cost | Within the Workers plan: 1,440 sweeps/day, about 3 queries per idle sweep. Free-plan CPU is 10 ms per invocation; a busy sweep may need the Workers Paid plan. Check current Cloudflare pricing before launch | A usage-billed plan on top of Cloudflare, plus run-time charges for long polls |
| Latency | A step at most once a minute after the first ~30 s (`after()` fast path) | Seconds |
| Strengths | Simple, nothing new to operate | Built-in retries, dashboards, long-running tasks |

Revisit if clip polling at one-minute granularity becomes a product problem, or if heavy work ever has to run inside the runner (rendering belongs in the media worker, not here).

How it works:
- `src/worker.ts` is the Worker entry: vinext serves requests, and `scheduled()` runs `sweepJobs()` every minute (`cloudflare.config.ts` → `triggers.scheduled`). Locally, `startLocalRunner()` sweeps every 3 s in the Node process.
- A sweep is bounded (10 jobs, 20 s). It picks jobs with a due attempt and an expired or absent lease, plus jobs whose items all finished but were never settled.
- Leases carry a token (the exact `lease_until` value). Each step renews it; a runner that lost its lease stops and cannot clear another runner's lease. A completed result is stored under a row lock, at most once.
- A crash between "submitting" and saving the request id becomes `unknown` and is reconciled by idempotency key; if the provider cannot look it up (fal), it goes to manual attention with credits held. Nothing is blindly resubmitted.
- A job unfinished after an hour is flagged `needs_attention` and keeps running. Admins can mark unknown items failed, resubmit them (explicit duplicate-charge warning), or **stop unfinished** items: delivered items stay settled and the rest of the hold is released.
- `GET /api/jobs/[id]` only reads persisted state; polling no longer drives work. `POST /api/jobs` still starts the first steps in `after()`.
- Each sweep writes a heartbeat to `admin_settings.runner`. The admin page shows it, and `/api/health` returns `runnerAgeSeconds` so a deploy check can confirm the cron fires.

## Not built yet

- FFmpeg media worker service (`services/media-worker`): the adapter contract exists in `providers/worker.ts`.
- Playwright E2E/axe specs, CI workflow, Lighthouse runs, CSP header.
- Custom-domain activation and end-to-end hosted Google sign-in verification. The basic Workers deployment and GitHub workflow now exist; see `docs/DEPLOYMENT.md`.
