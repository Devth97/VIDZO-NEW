# Verification log

## 28 November 2026 — Slice 3 part 1: media worker (Claude)

| Check | Result |
| --- | --- |
| `python -m unittest discover -s services/media-worker/tests` (CI, Ubuntu `ffmpeg 8.0.1-3ubuntu2`) | Passed: 13 tests, none skipped. The render test encodes synthetic portrait (720×1280) and landscape (1280×720) test-pattern clips plus a logo. It produces 1080×1920, 30/1 fps, H.264 yuv420p, AAC, 5.0 s ±0.15 s; it decodes cleanly, reports the upscaling, and deletes the inputs |
| Same suite locally (Windows, no FFmpeg) | 12 passed, render skipped |
| Fixed during CI | x264 `malloc failed` under a 3 GB `RLIMIT_AS`. FFmpeg 8 reserves far more virtual memory than it uses, so RAM is now left to the container limit and `RLIMIT_AS` is a 16 GB runaway guard; filter threads are capped |
| App side | `tests/worker-adapter.test.ts` covers the submit contract, missing clips, unknown submissions, safe failure reasons, the report stored on the export, and reconciliation. A CTA over 80 characters blocks the export quote |
| Gates | typecheck, 87 tests, both builds and the Cloudflare typecheck passed; GitHub run "Verify and deploy VIDZO" succeeded |
| Not verified | No container host yet, so nothing ran on real infrastructure, behind TLS, or with real R2 signed URLs and generated clips. Resource limits on Linux are exercised only in CI |

Slice 2 in production: after the cron trigger was deployed (07:57 UTC), `https://vidzo.tech/api/health` reported `runnerAgeSeconds: 2` at 08:02 UTC. It stayed under 30 s after the following redeploy.

## 28 November 2026 — Slice 2: durable job runner (Claude)

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm typecheck:cloudflare` | Passed |
| `pnpm test` | Passed: 8 files, 82 tests (5 new runner tests in `tests/server.test.ts`) |
| `pnpm build`, `pnpm build:vinext`, `pnpm audit --prod` | Passed; no known vulnerabilities |
| Workers build output | `worker.config.json` carries `triggers: [{ type: scheduled, schedule: "* * * * *" }]`; the bundle's default export is vinext's handler plus `scheduled()` |
| Runner tests (PGlite, simulated provider) | A job finishes through cron sweeps alone, with no polling, and records a heartbeat. A job under another runner's lease is skipped, then resumed once that lease is abandoned. A crash mid-submission is reconciled by idempotency key: one provider submission, one stored frame. A job whose items finished before a crash is settled and its credits released. A job past one hour is flagged and keeps running; the admin "stop unfinished" action releases the hold |
| Not verified | No live job has run through the deployed cron: live pricing and providers are not configured. Lease contention was tested with interleaved transactions on one PGlite connection, not with parallel Postgres backends |

## 28 November 2026 — Slice 1: quote and review clarity (Claude)

| Check | Result |
| --- | --- |
| Baseline before changes | `pnpm typecheck` passed; `pnpm test` 7 files, 70 tests passed |
| `pnpm typecheck`, `pnpm typecheck:cloudflare` | Passed |
| `pnpm test` | Passed: 8 files, 77 tests (7 new in `tests/review.test.ts`) |
| `pnpm build`, `pnpm build:vinext` | Passed |
| Browser, demo mode, real Chrome via Playwright | Sample project → frame quote → keyboard confirm → simulated frames → approve all. Purpose change kept all 3 approvals; a product action on scene 2 removed only scene 2's approval; clearing it restored the approval. Video quote shows duration, 9:16, scene count, delivery format, model, native resolution, upscale disclosure, per-item credits, available/held/after-hold and the three failure/redraw outcomes. Advancing the page clock past expiry replaced Confirm with "Get a fresh quote". No horizontal overflow at 320/360/768/1024/1440 px on Storyboard, Generate, Brand and the quote dialog. axe WCAG A/AA: 0 violations on both quote dialogs and the storyboard. No console or page errors |
| Fixed during QA | Dialog focus fell to the close button because Confirm is disabled while the quote request finishes, so Enter closed the dialog. Initial focus now goes to the quote summary (Enter alone can never confirm a spend) without scrolling the dialog title away on phones |
| Not verified | The product-photo comparison and its required "product matches my photos" check were not exercised in a browser: the demo sample has no product photos. Covered by code review only. Live mode with real pricing, wallet holds and provider jobs not exercised |

## 25 November 2026 — creation-first UI and Astryx (Claude)

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm typecheck:cloudflare` | Passed |
| `pnpm test` | Passed: 6 files, 67 tests |
| `pnpm audit --prod --audit-level=moderate` | No known vulnerabilities |
| `pnpm build`, `pnpm build:vinext` | Passed |
| Browser (demo mode) | See `docs/UI_RESEARCH.md` → "Creation-first update". Desktop, 360 px and narrow-column layouts; keyboard paths; double-submit regression fixed |
| Not verified | Live Google sign-in round trip with the new composer intent (no test account used); Lighthouse/axe automated runs this pass |

## 25 November 2026 — editorial UI and domain status (Codex)

- Audited public entry pages of Creatify, Arcads, Higgsfield, AdCreative.ai and Pencil; checked current GitHub Trending and component repositories. Research and design contract: `docs/UI_RESEARCH.md`. No competitor conversion figures or private dashboards were available; no conversion lift is claimed.
- Redesigned homepage, creative-direction gallery, pricing, Google sign-in and workspace welcome; standardized buttons and updated the provisional wordmark icon. Added three original AI-created concept stills, delivered as six responsive WebP files. Clearly labeled as illustrative, not customer work or video outputs.
- Isolated Chrome at 360/768/1440px: homepage, gallery, pricing, demo projects and live-mode sign-in have no page overflow or axe WCAG A/AA violations. Verified image loading, filters, dialog close, menu Escape/navigation close, draft CTA/autofocus and required sign-in consent. Sign-in submission used an intercepted error response, not a new external login. No uncaught browser errors.
- 67 tests, main typecheck, Next build, Cloudflare build and Cloudflare typecheck pass. Retained server authentication/credit guards; no provider, payment or customer-data changes.
- Separately confirmed the new Cloudflare zone active under promptpacktech@gmail.com with art/tegan nameservers, and custom-domain `/api/health` returned OK. The old account's moved-zone email is expected. User screenshot now shows Google's consent label as VIDZO; completing login after that screen is not established by the screenshot.
- User-selected Creatok follow-up: added a task-first draft starter with working name suggestions and private same-tab name handoff. Verified demo modal prefill, signed-out return path retention, no name leakage into URL, 67 tests and typecheck. The first editorial deployment (`50a5e84`) passed GitHub verification/deployment; the follow-up remains subject to its own deployment checks.

## 25 November 2026 — hosted database and Cloudflare (Codex)

- Connected the owner's existing `vidzoauth` Supabase project through its connector. Applied the initial schema and hosted-permission hardening migration; all 15 tables have RLS enabled. Verified anonymous and signed-in API roles cannot execute any credit/payment mutation function. The local auth stub now mirrors Supabase's explicit default function grants.
- Verified the privately saved pooler connection against hosted Postgres over strict TLS using Supabase's official CA; 15 tables and 15 RLS protections confirmed. Secrets remain in ignored local files and encrypted deployment settings, not Git.
- Added a basic vinext/Cloudflare build alongside Next.js. The owner selected no shared response/data cache and no image optimization. The personal Cloudflare account is pinned; inherited company API credentials are removed for local deployments.
- Published the app at `https://vidzo-studio.promptpacktech.workers.dev`. Confirmed HTTPS homepage/sign-in/session responses, unauthenticated workspace rejection, the real Google OAuth initiation URL, PKCE cookie and production callback. Viewed the published Google sign-in page in Chrome. This verifies OAuth initiation, not completion of Google consent or production-domain login.
- 67 tests pass, both TypeScript configurations pass, Next.js and Cloudflare builds pass. The production dependency audit reports no known vulnerabilities after updating Vite and pinning the patched fflate dependency. Added regression tests for strict TLS, hosted function privileges and database readiness.
- The Worker readiness probe exposed a runtime-specific TLS failure that did not appear in Node. Configured Hyperdrive with Supabase's official CA, `verify-full`, caching disabled and five origin connections; added a Worker-specific client lifecycle that preserves transactions without sharing sockets across requests. Three successive hosted `/api/health` requests return HTTP 200 with `status: ok`.
- Added GitHub verification/deployment with repository secrets and a scoped personal-account deployment token. The workflow checks hosted database readiness after publishing. The first GitHub run passed both verification and deployment, including hosted database readiness: https://github.com/Devth97/VIDZO-NEW/actions/runs/45563151505 (application commit `48a58de`).
- The personal account's free `vidzo.tech` zone is pending nameserver activation. Existing nameservers remain unchanged; production-domain login is not yet verified. See `docs/DEPLOYMENT.md` for the exact remaining DNS and release steps. AI, R2, real payments, background runner and FFmpeg remain unconfigured/incomplete.

## 25 November 2026 — Google sign-in (Codex)

- Live sign-in now uses Google through Supabase; local test links remain local. No hosted Supabase or Google Cloud project was created, connected or changed, and no company account was used. The owner explicitly excludes `@prorack.ai` accounts from VIDZO infrastructure ownership.
- Typecheck passes; 61 tests pass across 5 files (16 new auth/UI tests). The real Supabase SDK generates the Google authorization URL and PKCE cookie; callback tests use simulated token responses to verify session cookies, draft return and rejected-code handling. Covered: consent gating, cross-site initiation, external return paths, mode restrictions and missing origin. A deliberately inverted consent condition was caught by its regression test, then restored.
- Production build passes with the Google route included. Production dependency audit reports no known vulnerabilities.
- Real headless Chrome at 360 px: local sign-in form, required consent, keyboard submission, saved draft return payload, honest local-link copy and no horizontal overflow; axe WCAG A/AA audit on the sign-in panel passes, no uncaught page errors. Email endpoint response was intercepted, so this did not create an account or send email. Live UI rendering is covered by component tests.
- **Not verified:** real Google consent, hosted Supabase provider settings, hosted callback/cookie delivery and live workspace creation. Requires the user's approved personal account and configured project. See `docs/GOOGLE_SIGN_IN.md`.

## 25 November 2026 — backend, screens and browser QA (Claude)

| Check | Result |
| --- | --- |
| `pnpm typecheck` (now `--incremental false`) | Passed. The earlier script reused a stale `tsconfig.tsbuildinfo` and could report a false pass; fixed. |
| `pnpm test` | Passed: 3 files, 45 tests (domain 26, media parsing 9, server integration 10) |
| `pnpm build` | Passed: 13 pages, 27 API routes and the auth callback |
| Server integration tests | Run against **PGlite** (embedded Postgres) using the real `supabase/migrations` SQL: ledger reserve/finalize/capture functions, append-only trigger, non-negative balances, RLS two-tenant isolation with the `authenticated` role, asset immutability, optimistic concurrency, forged-field rejection, upload byte verification, full frames→approve→clips→export→QA flow, failure release, unknown-outcome reconciliation, free-analysis limit, webhook signature/duplicate/replay/amount-mismatch/out-of-order handling |
| Browser QA, local backend (`pnpm dev:local`) | Passed in a real Chromium pane: email link sign-in, zero-credit start, project creation (keyboard), real 6.5 s H.264 MP4 recorded in-browser and verified server-side from bytes, signed private preview playback, analysis job, roles, 250-credit purchase via signed test webhook, identity sheets (double-click → one reservation), real PNG uploads + disguised file rejected, brief, frames, approvals, selective invalidation (only edited scene lost approval; revert restored it), clips, assembly, download blocked (403) before QA, admin reject requires note, approve → download with attachment + sandbox CSP |
| Browser QA, explore mode (`pnpm dev`) | Passed: v1 draft migration (old approvals not trusted), sample project end to end, simulated 300→165 credits, no console errors |
| Responsive | No page-level horizontal overflow at 360 px on landing, pricing, projects, studio, admin (wide admin tables scroll inside their container); tablet 768 px studio checked. Fixed: step badge wrapping at 360 px |
| Bugs found and fixed in QA | Sign-in consent label contained links that navigated away on click; modal autofocus never focused (typing lost); sample entry disappeared once drafts existed |

### Not verified (needs your accounts or infrastructure)

- Supabase Auth email delivery, `/auth/callback` code exchange, and the migration on a real Supabase project (only run on PGlite). True multi-connection lock contention (PGlite is single-connection).
- R2 presigned PUT/GET, CORS, ranged reads.
- Gemini analysis, fal submissions/results, media worker assembly. Adapters typecheck and are unit-shaped, but **no provider call has been made**. The fal input mapping must be checked against the selected endpoint's schema.
- Razorpay order creation, Checkout, and real webhook delivery.
- Fragmented MP4s whose `mvhd` duration is 0 would be rejected (Chrome's own recordings carry a real duration and pass). Full decode/corrupt-frame checks belong to the FFmpeg worker, which is **not written yet**.
- Lighthouse/axe automated audits and Playwright E2E specs are not written; QA above was interactive.
- No hosting deployment exists.

## Earlier handoff (GPT)

Foundation passed typecheck/test/build with 10 tests; no browser QA had been done.
