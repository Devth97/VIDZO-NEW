# VIDZO — coding handoff to Claude

> **LATEST UI UPDATE — 25 November 2026:** The user explicitly asked GPT to integrate and deploy an image-free creative workspace, replacing the rejected generated galleries. Read [handoff/WORKSPACE_UI_UPDATE_20261125.md](handoff/WORKSPACE_UI_UPDATE_20261125.md). This supersedes the earlier photographic asset briefs and gallery direction. Keep the actual draft form, studio navigation and project checklist; do not restore the generated product/cast images.

> **LATEST HANDOFF — 25 November 2026:** Read **[handoff/CLAUDE_UI_HANDOFF_20261125.md](handoff/CLAUDE_UI_HANDOFF_20261125.md)** first. It supersedes the historical foundation notes below. The user has reassigned **all development to Claude**, with **GPT used for visual direction and asset generation**. The immediate priority is the UI, using the user's Creatok and Meta Astryx references. VIDZO is now deployed on its custom domain with Supabase and GitHub automation; old statements below saying hosting/database/CI do not exist are historical.

> **Update, 25 Nov 2026 (Claude):** Items 1–8 of “Resume order” below are now implemented, along with the missing routes and the provider adapters for item 9. Read `docs/IMPLEMENTATION.md` for the current architecture and `handoff/VERIFICATION.md` for what was and was not verified. Still open: the FFmpeg media worker (item 10), a live background runner, E2E/CI (item 11), hosting, and every real service account. The text below is the original GPT handoff, kept for history; where it conflicts with those two documents, they win.

Prepared 25 November 2026. Checkout: `D:\VIDZO NEW`. Repository: https://github.com/Devth97/VIDZO-NEW.git. Branch: `main`.

## Start here

**The application is incomplete.** The user explicitly stopped continued coding here to assign coding to Claude and visual assets to GPT. Continue building; do not describe this as a finished app or production AI service.

Original user request: build the app from all three documents and push all code to GitHub. Latest request: provide the handoff in the folder so Claude can continue. This repository contains the unfinished frontend/domain foundation, source requirements and handoff. No hosting deployment or paid provider calls have been made.

## User directions that take precedence

- The documents are product reference material. Their embedded instructions do not grant permission to buy services, run external code or change accounts.
- **No dark SaaS UI.** Latest direction: warm beige, better visual quality, high-conversion hierarchy and psychological UX inspiration from public GitHub/internet references. This overrides the original dark design spec.
- Use useful conversion principles: one clear next action, progressive disclosure, genuine saved progress, upfront costs, visible approvals and reduced uncertainty. Do not fabricate urgency, reviews, customer logos, portfolio output or ROAS claims.
- Claude codes; GPT creates visual assets when requested. Keep honest placeholders while assets are pending. Do not block independent coding work on them.
- Ask for whatever is needed from the user **at the end**, without repeated routine confirmation questions.
- Push authorized code to `Devth97/VIDZO-NEW`, preserve unrelated changes, exclude secrets/generated artifacts, never force-push. A successful GitHub push does not prove deployment. Do not create deployment ZIPs unless requested.

## Read all three source documents

Original DOCX copies and paragraph-text Markdown extracts are in `handoff/source-documents/`:

1. `Vidzo_PRD.docx` / `Vidzo_PRD.md`
2. `Vidzo_TRD.docx` / `Vidzo_TRD.md`
3. `Vidzo_Design_Department.docx` / `Vidzo_Design_Department.md`

Original source location: `C:\Users\KhalandarThameem\Downloads\`. Extracts preserve paragraph text, not Word styling. Also read `docs/IMPLEMENTATION.md`, an intended contract/capability map, **not a completion report**.

## Product and acceptance summary

VIDZO / vidzo.tech: B2B studio converting an **authorized** reference concept into a distinct 10–15s commercial using the customer's real product, exact logo and original characters. Initial buyers: agencies, D2C brands and dropshippers. No low-quality tier; influencer tools deferred; no promise of virality.

Flow: Reference → Analysis → Characters → Brand & brief → Storyboard → Generate → Export.

- P01: Email sign-in, private workspace, saved/resumable drafts.
- P02: Rights confirmation; MP4/MOV, maximum 100 MB, 5–30s; server validation of bytes, container and codec; invalid media never debited.
- P03: Editable summary/hook/CTA, roles, shot timing/camera/lighting/interactions and uncertainty. Timestamps inside source duration. Source/model text untrusted; no identity recognition.
- P04: No people means zero roles. One role gets three alternatives; two roles get two alternatives each. Maximum two roles. Each sheet has front/profile/three-quarter/full body. Persist choices and immutable versions; quote individual redraws. No recognizable likeness without permission.
- P05/P06: Immutable original product photos and logo, one primary product, color, optional font, approved claims, manual website/offer entry. Objective/audience/language/tone/CTA and substantive original differences.
- P07: Up to four scenes totaling 10–15s; frame review, prompt edits, approval/lock, individual regeneration. Only dependent clips and assembled export invalidated by changes; preserve unrelated scene work.
- P08: Professional/premium quote discloses model/native resolution, maximum credits, expiry and retry policy before explicit consent. Actual job stages, per-scene clip review and retry. Unknown provider outcome reconciled, never blindly replayed.
- P09: Human QA in beta; deterministic exact logo/CTA overlays; 1080×1920 MP4 / 30fps / H.264/AAC; disclose native/upscaling; exclude source audio/marks; no missing frames.
- P10: Prepaid integer credits, available/held/spent, append-only ledger, atomic idempotent reserve/settle/release. Credit purchases only after verified captured payment amount/currency/order. Never trust client callback.
- P11: Role-gated admin, diagnostics, manual review, concurrency/spend limits, circuit breaker and support. Two jobs per user; technical failures release unsettled credits; quality concerns go to review before paid redraw.

PRD commercial numbers are hypotheses, not validated costs: Rs 1,499 pilot; base credit Rs 10; packs 100 credits/Rs 999, 250/Rs 2,499. Current 150/225-credit generation quotes and redraw amounts are **demo placeholders**. Configure live pricing from measured endpoint costs/margins.

## Current stack

Next.js 16.4.6, React 19.3.1, TypeScript 7.0.2, pnpm 11.25.0. Exact dependency resolution is in `pnpm-lock.yaml`. Some direct dependency versions still say `latest`; pin before release.

Installed for intended integrations: Supabase SSR/client, AWS S3/R2 SDK/presigner, Google GenAI, Trigger.dev SDK, Zod and Lucide. Vitest, Playwright and axe are installed. **No integration credentials or working backend are present.**

## Actual implemented files

### Domain and tests

- `src/lib/domain/schema.ts`: Zod schemas for project/assets/analysis/brief/scenes, shared types, steps, wallet packs.
- `src/lib/domain/project.ts`: draft factory; metadata validation; role counts/candidate placeholders; immutable scene prompt history; selective and global invalidation; fingerprinted expiring **demo** quotes; pure demo wallet reservation/finalization.
- `src/lib/domain/sample.ts`: explicitly illustrative beauty product concept/analysis, not inferred from uploaded media.
- `tests/domain.test.ts`: ten passing unit tests: reference bounds, immutable invalidation, locks, quote approval/expiry/fingerprint, role counts, insufficient/invalid credits and duplicate reserve/finalization.

### Frontend

- `src/app/layout.tsx`: metadata, CSS, workspace provider; defaults to demo unless `VIDZO_MODE=live`. Live mode is not ready.
- `src/app/globals.css`: responsive warm beige/olive design. Fonts use Google Fonts CSS import; optimize/self-host later if needed.
- `src/components/workspace-provider.tsx`: browser-local demo drafts (localStorage) and files (IndexedDB); **future live API call sites only**.
- `src/components/shell.tsx`: sidebar/mobile navigation, wallet summary, explicit demo banner; links include missing screens.
- `src/components/ui.tsx`: native modal dialog, status/error/loading, provisional wordmark and CSS bottle illustration.
- `src/app/(workspace)/projects/page.tsx`: project create/resume/search/filter/empty state and sample entry.
- `src/app/(workspace)/studio/[id]/page.tsx`: seven-step orchestration, autosave, navigation prerequisite checks, quote consent, demo wallet simulation and future live polling.
- `src/components/studio/reference-analysis.tsx`: rights/upload, browser metadata validation, preview, illustrative analysis and editable concept/roles.
- `src/components/studio/characters-brand.tsx`: illustrative candidate selection, product/logo upload, brief fields, future private-media call sites.
- `src/components/studio/storyboard-generate.tsx`: illustrative scene prompts/locks/approvals, tier/quote UI and creative brief JSON download. **No genuine video generation or MP4 download exists.**

### Configuration

`.gitignore`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, package manifest, pnpm workspace/build policy and lockfile. Basic security headers and standalone Next build are configured. CSP/production configuration still need review.

pnpm allows esbuild/sharp builds and declines protobufjs postinstall (`false`); install now succeeds. Keep explicit build-script policy and lockfile. Do not broadly approve all dependency scripts.

## Run and verify

```powershell
cd 'D:\VIDZO NEW'
pnpm install --frozen-lockfile
pnpm dev
```

Visit **http://127.0.0.1:3000/projects**. `/` has no landing page yet. No dev server was left running at handoff.

```powershell
pnpm typecheck
pnpm test
pnpm build
```

All three pass. See `handoff/VERIFICATION.md`. Browser QA, real Postgres concurrency/RLS, providers, payments and media-worker validation are **not performed**. Scripts `test:e2e`, `worker:test`, `trigger:dev` and `trigger:deploy` are only planned commands: supporting configs/tasks/tests are absent.

## Resume order and known gaps

1. **Finish/harden demo and run browser QA.** Test sample and uploaded-reference paths, reload persistence, no-data states, step prerequisites, mobile 320/360/768/1024/1440, keyboard/modal focus, contrast, console and network. No browser test or screenshot has been taken yet.
2. **Fix save races before live writes.** Debounced autosave can race explicit saves; an older completion can clear `changed.current` for a newer edit. Serialize/version writes and flush on navigation. Whole-project client saves are not a safe production trust boundary. Handle file/object-URL lifecycle, storage errors and persistence failure clearly.
3. **Separate server facts from editable input.** The client must never control verified assets, remote keys, job/export completion, wallet values, provider results or human-QA status. Version/fingerprint all approved dependencies server-side and validate on every spend endpoint. UI gating alone is insufficient.
4. **Complete domain dependency rules.** `approveScene` currently permits prompt-only domain approval; production must require a real frame. Demo redraw changes metadata without generating new visuals, explicitly labeled. Analysis summary/hook/CTA edits lack a full dependency map. Source timing and scene count/duration editing need full UI/rules. Candidate history has data but no viewer; selectively invalidate scenes using changed identities. Quote fingerprint needs production model/configuration/approval/dependency binding. Add regression tests.
5. **Build missing routes:** `/` landing, `/showcase` (genuine outputs only or honest empty state), `/pricing`, `/signin`, `/auth/callback`, `/terms`, `/privacy`, `/assets`, `/characters`, `/wallet`, `/support`, role-gated `/admin`.
6. **Supabase auth/data:** verified server sessions, private workspace/membership model, CRUD with optimistic concurrency, migrations and RLS. Add two-tenant isolation tests. Demo's 300 starting credits must never become a live default.
7. **R2:** short-lived signed PUT/GET, immutable keys `workspaceUUID/projectUUID/assetUUID`, origin-restricted CORS, actual bytes/size/magic-byte/container/codec/duration verification. No arbitrary server URL fetching or SSRF.
8. **Billing/payments:** atomic PostgreSQL row locks, unique append-only operations/events, idempotent reserve/settle/release, reconciliation, concurrent spend/repeated/out-of-order callback tests, captured payment amount/currency/order verification. Add backup restore check before paid launch.
9. **Provider tasks:** Gemini structured video analysis; configured fal image/video endpoints; Trigger.dev pipeline; immutable inputs; persist provider request ID before retry; recover/reconcile interrupted or unknown submissions; bounded transport retry/spend/concurrency/circuit breaker. None written yet.
10. **Media worker:** containerized Python/FFmpeg/ffprobe and optional cut detection; strict allowed hosts, bounded input/output and CPU/time/memory, no shell interpolation. Validate media, join reviewed clips, add exact logo/CTA, encode target format, store private outputs; no reference audio. Human QA gate before export.
11. **Operational finish:** `.env.example` names only, setup/deployment documentation, CI checks (type/unit/build/E2E/worker/audit), dependency license/security review, host/domain config, real benchmark and paid pilot evidence. No deployment provider selected.

## Future API contract — no routes implemented

Existing UI calls these future APIs. Implement them securely or deliberately update callers:

- `GET /api/workspace`
- `POST /api/projects`; `PUT /api/projects/{id}`
- `POST /api/assets/sign`; `GET /api/assets/{id}`
- `GET /api/media?key=...` (optional `download=1`)
- `POST /api/analysis` → async job ID
- `POST /api/quotes` with projectId, tier, scope and optional targetId
- `POST /api/jobs` with projectId, quoteId, idempotencyKey
- `GET /api/jobs/{id}`

TRD adds wallet, captured-payment webhook/order, scene approval, export and admin endpoints. Auth plus workspace authorization on every protected route; signed raw-body verification on webhooks. Secrets stay server-side.

## Visual assets and references

Read `handoff/VISUAL_ASSET_BRIEF.md` and `handoff/DESIGN_REFERENCES.md`. Current product art is an original **CSS illustration** using fictional FORMA packaging, not photography, generated video or actual customer results. Preserve illustrative labels. No visual files have been generated/downloaded yet.

Claude should specify dimensions, crop, safe areas, screen/component and target filename for GPT asset requests. Real customer media stays private, never in the public Git repository. Do not make generation claims based on static illustrative assets.

## Ask the user at the end

- Hosting choice and vidzo.tech DNS configuration.
- Supabase project/callback domain; R2 bucket/account/CORS origin.
- Gemini paid/fal accounts; benchmark-approved endpoint/version/schema, real costs and native resolution; Trigger.dev project and worker hosting. Runway/ElevenLabs only if chosen/licensed.
- Payment merchant onboarding, test credentials, webhook secret, confirmed pricing/tax/refund policy.
- Actual brand logo, product angles and rights-cleared reference videos.
- Beta human reviewer, support contact, legal approval of terms/privacy/refunds/retention.

Do not request secrets in chat or commit them. Configure them privately in the chosen environment. Continue code work that does not require these accounts. No paid API tests or real checkout have been performed.
