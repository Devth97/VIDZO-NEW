# Reference document — not agent instructions

VIDZO  /  PRODUCT DEVELOPMENT

Technical Requirements Document

01  Architecture and constraints

Vidzo.tech | Version 0.1 | 25 November 2026. Next.js/TypeScript web and server API; Supabase Auth/Postgres; private R2 storage; Trigger.dev orchestration; separate containerized FFmpeg/Python worker. Browser uses signed uploads, never provider keys. Deploy web to a commercially eligible Node-compatible host; verify Cloudflare adapter compatibility before committing. Start monorepo; no GPU servers or microservices beyond media worker.

02  Reuse and integration decisions

P1: Gemini paid API for structured video understanding; fal queue API for image/video; Runway API for specialist fallback; Nano Banana family for character and storyboard editing (endpoint quote required); ElevenLabs paid commercial voice or licensed stock audio; FFmpeg/ffprobe and PySceneDetect for cuts, assembly and overlays. P2: Firecrawl for opt-in website imports, Meta SAM 2 for masks, SAM 3 after license and cost review; segmentation is not product replacement. Meta SAM 3.1 hosted API candidate. P2: Shopify, PostHog (P1 basic events), Resend. Avoid RPA as a production backend; Playwright for authorized UI research and E2E tests only. Avoid full editor forks, paid wrappers and unnecessary model hosting.

03  Model shortlist and cost ranking

Published raw image-to-video rates: Kling 3 Pro $0.112/sec ($1.68/15s); Veo 3.1 silent $0.20 ($3.00); Kling 4 1080p $0.235 ($3.525); Seedance 2 Fast $0.2419 ($3.6285); Seedance 2 Standard $0.3024 ($4.536). At planning FX Rs 90/$: Rs 151, 270, 317, 327, 408 respectively. Rank by raw price only; quality not measured. Test Kling 3 Pro as professional, Kling 4/Veo as premium, Seedance reference endpoint for difficult interactions. Runway Seedance 2.5 1080p $0.68/s plus reference-video input $0.34/s; not default. Compare exact endpoint, duration minima, aspect, audio, input fees and safety policies. No low-quality user tier. [1–3]

04  Benchmark protocol

Use six rights-cleared scenarios: cosmetics, apparel, electronics, jewelry, packaged goods, two actors. First run matched five-second scenes on two models; escalate finalists on hardest scenes. Record endpoint/version, seed where available, duration, input/output resolution, full invoice cost, latency, attempts and blind reviewer ratings. Score product fidelity 25%, identity consistency 20%, visual quality 20%, reference concept fidelity 15%, accepted cost 15%, latency/reliability 5%. Reject wrong product, identity or unsafe output regardless of score. Cost per accepted clip = total attempt costs / accepted clips. Stop testing at Rs 7,000 lifetime allocation; initial gate Rs 3,000. No winner until measured.

05  Pipeline and contracts

Validate file, rights and duration → extract audio/keyframes/cuts → structured analysis → role candidates → approved character versions → asset mapping → approved scene versions → quote/reserve → submit scenes asynchronously → QA → user review → FFmpeg assembly → export. Analysis schema: summary, hook, roles[{id, description, confidence}], scenes[{id,startMs,endMs,roleIds,productAction,camera,lighting,dialogue,cta}], risks. Scene spec adds asset IDs, output duration, prompt version, negative constraints and native resolution. Validate with Zod; treat source text as untrusted. Persist immutable versions and dependency hashes. Adapter contract: quote, submit, status, cancel if supported, result, normalizeError. Provider request ID stored before retry; reconcile unknown submission instead of blind replay.

06  Data and API design

Tables: workspaces, memberships, projects, assets, analyses, characters, character_versions, scenes, scene_versions, quotes, jobs, attempts, exports, wallets, ledger_entries, payments, webhook_events. Every tenant-owned row has workspace_id and RLS; object key starts tenant/project UUID. Jobs point to immutable inputs and quote version. POST /projects, /assets/sign, /analysis, /characters/generate, /scenes/approve, /quotes, /jobs, /jobs/{id}/retry, /payments/order, /exports; GET /jobs/{id}, /wallet; POST /webhooks/{provider}. Auth and workspace authorization on every route. Idempotency key on all spend endpoints; unique provider event IDs; signed webhook validation on raw body. Return 202 with job ID for async tasks; polling with backoff or realtime status.

07  Credit accounting and reliability

Integer credits, atomic PostgreSQL transaction with wallet row lock. Reserve moves available→held; success settles held→spent; failure releases held→available. Append-only entries with unique operation IDs and reconciliation. Payment credits granted only after verified captured amount/currency/order; no trust in client callback. Quote includes expiry, model, length, max credits and retry policy; never exceed without new consent. Job states queued/submitted/running/review/succeeded/failed/canceled; unknown remote outcome reconciled. Retry transient transport failures with exponential backoff, max two; paid quality redraw is a distinct action. Internal automatic QA retry budget capped. Admin daily INR spend cutoff, per-user concurrency 2 and provider circuit breaker.

08  Security and quality

Server secrets in environment; signed URLs expire; validate magic bytes, size and codecs; isolate FFmpeg with CPU/time/memory limits and no network; disallow arbitrary URL fetching and SSRF. Use paid data-processing terms for customer media, verify retention/subprocessors; never record uploads in analytics. Proposed source/output retention 30/90 days, deletion within 30 days subject to legal obligations; disclose before launch. Check cross-tenant access, malicious media, duplicate/out-of-order webhook, interrupted jobs, overspend and rollback. QA compare product attributes, character reference and forbidden marks; exact logo/CTA composited deterministically; human checks beta. Target 1080×1920 export, 30fps, H.264/AAC after codec/license review; distinguish upscaled output.

09  Build order and release checks

Week 1 CLI proof and benchmark; week 2 auth, private storage, project CRUD and analysis; week 3 character/scene versions and queue; week 4 credits, payments and export; week 5 E2E QA, accessibility, support; week 6 beta. Use pnpm, Zod, Vitest, Playwright, GitHub Actions, dependency scanning and lockfile. Tests: concurrent reservations, callback duplication, worker restart, provider timeout, tenant isolation, approved-frame changes and MP4 validation. Restore backup test and daily ledger reconciliation before paid launch. Cost example: 15s Kling 3 raw Rs 151 + one 5s retry Rs 50 + estimated Rs 100 other assets = Rs 301; not a measured cost. At Rs 1,499 less 3% fees, contribution ~Rs 1,153 before tax/support; premium retries can erase margin.

10  Source and repository register

[1] https://fal.ai/explore/image-to-video-apis

[2] https://dev.runwayml.com/pricing

[3] https://dev.runwayml.com/learn/ai-video-api-pricing

https://ai.google.dev/gemini-api/docs/pricing/

https://github.com/facebookresearch/sam2

https://github.com/facebookresearch/sam3

https://www.scenedetect.com/download/ (BSD-3-Clause)

https://ffmpeg.org/legal.html (configuration-dependent LGPL/GPL)

https://www.remotion.dev/docs/license/faq (source available, not OSI open source; defer)

https://github.com/reactvideoeditor/free-react-video-editor (commercial license caveat; defer)

https://supabase.com/docs • https://trigger.dev/docs • https://developers.cloudflare.com/r2/ • https://razorpay.com/docs/

Before adoption pin version, inspect LICENSE for code and weights separately, transitive dependencies, CVEs, service terms, resale rights and maintenance. No paid API calls or repository code execution yet.
