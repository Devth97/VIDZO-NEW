# Verification log

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
