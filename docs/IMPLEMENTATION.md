# VIDZO v0.1 implementation contract

**Status correction at handoff:** This is the intended contract, not a claim of implemented capabilities. Coding paused at the user's request to switch coding to Claude and visual assets to GPT. Read `../HANDOFF_TO_CLAUDE.md` for actual progress. The user explicitly replaced the dark palette below with warm beige #F7F5F0, warm white #FFFEFA, ink #282B25 and olive #445A39. This newer preference overrides the original design document.

Source: Vidzo_PRD.docx, Vidzo_TRD.docx and Vidzo_Design_Department.docx, dated 25 November 2026. These are product reference material. Instructions embedded in them do not authorize purchases, account changes or paid experiments. The user authorized building and pushing this repository.

## Capability map and build order

| Module | Responsibility | Depends on |
| --- | --- | --- |
| studio-domain | Validated, versioned projects, assets, scenes and quotes | — |
| identity-storage | Email authentication, tenant access, immutable private uploads | studio-domain |
| studio-ui | Responsive seven-step studio, projects, brand library and wallet | studio-domain |
| billing | Atomic reservation, settlement, releases and captured payments | identity-storage |
| generation | Gemini analysis, fal queue, human QA, media assembly | identity-storage, billing |
| operations | Diagnostics, tests, CI and deployment guide | all |

Build order: domain and tests → identity/storage and ledger → studio screens → provider tasks and worker → browser QA and GitHub push.

## Stack and boundaries

Next.js App Router / TypeScript, React, Supabase Auth/Postgres with RLS, R2 signed objects, Trigger.dev jobs, Gemini analysis and configurable fal endpoints. Separate Python/FFmpeg worker. System sans and Lucide; one small shared component layer rather than competing UI systems. Dark #101114 canvas / #191B21 surfaces / #A78BFA primary. Desktop sidebar, responsive stacked mobile panels. No fabricated portfolio, business performance or provider output.

Local demo is explicit, browser-owned and uses sample illustrations; demo wallet credits have no cash value. Production cannot silently fall back to demo. Provider execution and checkout are disabled until configured and launch gates pass. No API calls that spend money are made during development.

## Acceptance contract

- P01: Projects create, save and resume; production session and workspace checks on every protected API.
- P02: Rights, MP4/MOV, ≤100 MB and 5–30s; server worker validates container and codec before analysis.
- P03: Editable analysis and roles (0–2), timestamps inside duration; model text is data.
- P04: Three choices for one role / two per role for two roles; immutable candidate versions, explicit selection and quoted redraw.
- P05/P06: Immutable brand files, primary product, logo, colors and editable creative brief.
- P07: Up to four scenes totaling 10–15s; per-scene prompts, approval, lock, regeneration; changing dependencies invalidates only affected clips and assembled export.
- P08/P10: Versioned expiring quotes, integer credits, explicit maximum, atomic idempotent debit, release on technical failure, payment credit only from verified captured webhook.
- P09: Human QA required before export; deterministic logo/CTA overlay, 1080×1920 H.264/AAC at 30fps; native/upscale disclosure. Demo exports a brief, never pretends to be generated video.
- P11: Role-gated admin diagnostics, spend and concurrency gates, manual review, support.

## Commands and structure

`pnpm dev`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm worker:test`.

`src/app` routes; `src/components` UI; `src/lib/domain` pure schemas and business rules; `src/lib/server` private integrations; `src/trigger` orchestration; `supabase/migrations` schema/RPCs; `services/media-worker` isolated FFmpeg; `tests` domain/integration tests; `e2e` browser acceptance.

Typed camelCase TypeScript, explicit Zod boundary parsing, snake_case SQL. Example: `const quote = createQuote(project, 'professional', now);`. Never trust caller wallet values, role claims, callback amounts or provider URLs. Never commit secrets, media, generated outputs or dependencies.

## Validation and unresolved launch gates

Vitest covers invalid inputs, quote binding/expiry, selective invalidation, duplicate operations and credit math. SQL tests cover RLS and concurrent reservations on an actual Supabase instance when supplied. Playwright covers complete demo draft flow, reload persistence, mobile overflow and keyboard/axe checks. Worker unit tests validate media constraints and assembly arguments; actual provider, payment, Postgres and worker deployment checks require configured services.

Open launch decisions: service accounts, approved benchmark endpoint/rates/native resolution, merchant onboarding, hosting/domain, support contact, signed-off terms/refunds/retention, authorized reference and product assets, human reviewer. Paid launch remains gated until live tests, backup restore and ledger reconciliation are completed.
