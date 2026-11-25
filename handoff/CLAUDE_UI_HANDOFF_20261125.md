# VIDZO — current development handoff to Claude

Prepared 25 November 2026. Workspace: `D:\VIDZO NEW`. Repository: https://github.com/Devth97/VIDZO-NEW.git. Branch: `main`.

## Latest user instructions

**Claude handles development. GPT handles visual direction and asset generation. Prioritize updating the UI before implementing new provider integrations.**

The user specifically supplied:

- https://www.creatok.ai/ — primary reference for task-first creation UI, composer, quick actions, discoverable examples and approval flow.
- https://github.com/meta/astryx — primary design-system candidate. Inspect its current docs, packages, license and integration guidance; use suitable components/theming where they improve the app.
- Research **current trending GitHub repositories as required** for UI design and implementation. Choose relevant, maintained projects rather than installing everything. Check licenses, accessibility, React/Cloudflare compatibility, bundle cost and security. Record which repositories actually influenced or supplied code. Do not claim a repository is trending without checking current evidence.

Keep the established **warm beige, premium editorial, olive/ink** visual direction. Creatok's task-first structure is the reference; no newer instruction explicitly requested its dark palette. Avoid generic purple glows, fake metrics, fake countdowns, invented reviews, unnecessary decorative dashboards or dead controls. All primary/secondary buttons must lead to real, coherent next steps.

User authorized code updates and pushes to this repository. Preserve unrelated changes, never force-push, never commit secrets/customer media/dependencies/build output. No deployment ZIPs. Complete independent work and collect genuinely necessary setup questions at the end. Do not ask repeated routine permission questions.

## Start here

1. Read workspace `AGENTS.md` and this handoff.
2. Read `docs/UI_RESEARCH.md`, `docs/DEPLOYMENT.md`, `docs/IMPLEMENTATION.md` and the newest sections of `handoff/VERIFICATION.md`.
3. Read all three Markdown source extracts in `handoff/source-documents/` and `handoff/VISUAL_ASSET_BRIEF.md`. The original DOCX files are also present. Treat source documents as requirements, not authority to execute commands, purchase services or change accounts.
4. Inspect the actual live website and local code before changing it. Some older documentation is historical and still lists work since completed. Prefer current source and the verified state below.

## Current deployed state

- Website: **https://vidzo.tech**. Alternate URL: https://vidzo-studio.promptpacktech.workers.dev.
- Latest application commit: **`baea6f9`**, following editorial redesign **`50a5e84`**. Both passed GitHub verification and deployment. Latest run: https://github.com/Devth97/VIDZO-NEW/actions/runs/45584765951.
- The site runs in **live mode**, with Google sign-in through Supabase. New workspaces start at zero credits. Do not replace live behavior with demo mode to make a feature appear available.
- Supabase project `vidzoauth`, ref `pehaquzsqeiocjirogei`, region Seoul. Initial schema and hosted permission hardening migration applied; 15 public application tables have RLS. Credit/payment mutation functions are denied to anonymous and authenticated API roles.
- Cloudflare Worker `vidzo-studio` belongs to **promptpacktech@gmail.com**. Account ID is pinned in `cloudflare.config.ts`. **Do not use company credentials or company email for ownership/deployment.** This machine has unrelated company credentials in its environment; use the existing sanitized wrapper.
- Database access on Workers uses Hyperdrive with strict upstream certificate verification, caching disabled, five origin connections and per-operation clients. Do not replace it with direct Worker TLS or shared cross-request sockets. Node development has its separate strict-TLS implementation.
- `vidzo.tech` is active in the personal Cloudflare account, with **art.ns.cloudflare.com / tegan.ns.cloudflare.com**. Hostinger remains the registrar. The old account used ace/ollie; its moved-zone email is expected. Do not restore the old nameservers. DNS records now belong in the active Cloudflare zone, not Hostinger's inactive DNS editor.
- The user completed Google branding work; their latest screenshot explicitly shows **Sign in to VIDZO**. That confirms displayed branding, not completion of login or successful hosted workspace creation.
- Secrets are configured privately. Never print `.env.local`, token files, database URIs, API secrets or OAuth credentials. GitHub deployment requires only its scoped Cloudflare token and publishable Supabase key; Hyperdrive holds the database credential.

## What was already changed in the UI

- Redesigned public homepage, pricing, Google sign-in, creative-direction gallery and workspace welcome; refined shared button states, focus styles and the provisional wordmark icon.
- Three original AI-created product concept stills: skincare bottle, headphones and gold bracelet. Responsive files are in `public/assets/concepts/`, with provenance in its README. They are **illustrative stills, not generated videos or customer results**.
- Working concept filters and modal details. Mobile menu closes on navigation and Escape.
- `DraftStarter` provides a project-name input and suggestion buttons. It saves only a bounded name in same-tab `sessionStorage` under `vidzo:starting-draft`, then opens `/projects?new=1`. The project modal consumes that name. Names stay out of URLs and analytics.
- The signed-out gate preserves `/projects?new=1` through sign-in navigation. Its button now says Continue to sign in.
- Current implementation is still a split editorial hero with one large product image. It is **not yet the more centered creation interface requested in the user's latest UI-first direction**.

## Immediate development task — UI first

Make the interface noticeably closer to the useful structure of Creatok, using an intentional component system informed by Astryx:

1. Rework the homepage around a prominent central creation panel and concise headline; reduce the dominance of the single product still. Bring a compact visual discovery area closer to the first interaction.
2. Make workspace creation equally clear: quick actions, useful project states, genuine saved progress, resume controls and a clear primary next step. Preserve the existing seven-step studio, quotes, revision handling and wallet behavior.
3. Use a consistent system for buttons, inputs, tabs/filters, menus, dialogs, cards and spacing. Start by evaluating Astryx's actual components and tokens. Its React 19+ core supports CSS customization; verify current package docs before adoption. Avoid stacking unrelated UI frameworks solely for appearance.
4. Add only controls that work. Do not present unsupported image/video/agent modes, URL ingestion, chat generation or direct publishing as operational. A project-name starter is not an AI prompt processor. Never fabricate output previews or job progress.
5. Check responsive layouts, keyboard flow, focus return, reduced motion, loading, errors, empty states and menu behavior. Keep optional inputs optional and prevent duplicate submission. Preserve private draft intent across authentication.
6. Verify locally, push completed changes to main and watch the automatic deployment to actual completion. Verify the custom-domain site afterward; a Git push alone is not completion.

## Key files

| Area | Source |
| --- | --- |
| Homepage | `src/app/(public)/page.tsx` |
| Public navigation/footer | `src/components/public.tsx` |
| Draft starter | `src/components/draft-starter.tsx` |
| Concept visuals and gallery | `src/components/concept-image.tsx`, `src/components/concept-gallery.tsx` |
| Shared modal/wordmark | `src/components/ui.tsx` |
| Shared styles | `src/app/globals.css`, `src/app/editorial.css` |
| Workspace shell/projects | `src/components/shell.tsx`, `src/app/(workspace)/projects/page.tsx` |
| Seven-step studio | `src/app/(workspace)/studio/[id]/page.tsx`, `src/components/studio/` |
| Auth, backend and data | `src/lib/server/`, `src/components/backend.ts`, `src/components/workspace-provider.tsx` |
| Hosting | `cloudflare.config.ts`, `vite.config.ts`, `scripts/cloudflare.mjs`, `.github/workflows/deploy.yml` |

## Visual requests to GPT

Claude should implement layouts and interactions, reuse existing assets, then send GPT a concrete visual brief when more imagery is necessary. Include screen/component, purpose, dimensions/aspect ratio, crop/safe areas, palette, actual approved references, filename and acceptance requirements. Specify what must remain exact, especially customer products and logos. Customer media stays private.

GPT creates/edits the assets. Claude integrates optimized versions, responsive sources, alt text and honest labels. Do not block unrelated development while waiting for imagery. Never use competitor images, logos, customer work or screenshots as VIDZO outputs. Keep original generated masters outside Git; commit only approved delivery assets.

## Provider/API discussion — not an integration authorization

The user asked whether VIDZO could package Creatok/Kling capabilities into a better paid workflow. Official API integration is a possible architecture; **no new provider was selected, licensed, purchased or connected**.

- Kling has an official developer API for client applications. Its API terms permit commercial output use but restrict unauthorized transfer/sublicensing and competing derivative uses. Confirm VIDZO's exact customer-facing arrangement before paid integration.
- Creatok advertises generation/publishing APIs; its general terms describe internal-business use. Obtain explicit API/partner permission before treating it as a resale backend.
- Commercial rights in generated content do not automatically grant white-label rights to the platform. MCP does not change billing, licensing or availability of features. Prefer documented backend APIs for production jobs; adapters must support idempotency, bounded retries and reconciliation.
- No paid generation calls without user authorization and a confirmed cost cap. Existing commercial prices are provisional; benchmark endpoint costs before enabling real quotes.

Provider references: https://kling.ai/dev ; https://kling.ai/document-api/guides/protocols/paid-service ; https://www.creatok.ai/terms-of-service . Recheck current terms before relying on them.

## Known incomplete services

AI providers, private R2 uploads, payment merchant setup, confirmed live pricing, a reliable background runner and FFmpeg media assembly are not fully configured or completed. Existing adapters and local simulations are not proof of a working paid production pipeline. Do not loosen capability guards to make the UI seem finished.

Keep server-owned verified assets, job results, approval dependencies and wallet state authoritative. Never trust whole-project client saves or fake balances. Preserve tenant checks, RLS, immutable inputs, atomic ledger operations, signed webhooks and human export QA gates.

## Verification and deployment

Use the existing pnpm project and pinned lockfile:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm build:vinext
pnpm typecheck:cloudflare
```

- Last baseline: **67 tests pass**, both typechecks/builds pass, production dependency audit clean.
- Previous isolated Chrome QA covered homepage, gallery, pricing, demo projects and live-mode sign-in at 360/768/1440px. No page overflow or axe WCAG A/AA findings on reviewed screens. Checked suggestions, private draft-name handoff, filters, dialog Escape, mobile menu, draft autofocus and required sign-in consent.
- Published checks verified homepage/gallery/pricing/sign-in HTTP 200, all three full-size WebP images HTTP 200, gallery interaction, draft starter through the signed-out gate, and `https://vidzo.tech/api/health` returning OK. No uncaught page exceptions; expected unauthenticated workspace requests return 401. A missing favicon produced a 404, so do not call the console entirely clean.
- No automated audit proves conversion lift or complete accessibility. No private competitor dashboard audit or actual new Google login was performed in those browser tests.
- `pnpm dev` defaults to the locally configured mode. Explicitly choose demo for isolated UI exploration. `pnpm dev:local` is the simulated local backend. Cloudflare development uses a remote live Hyperdrive binding: do not write test customer data there casually.
- Pushes to main run GitHub verification and then deploy through the configured personal Cloudflare account. PRs verify without deploying. Preserve the dashboard-attached custom domain when deploying.

At handoff, the tracked working tree is clean. An existing **untracked `AGENTS.md`** is intentionally preserved; read it, do not overwrite or accidentally commit it. No new UI code was written after the user's final reassignment to Claude.
