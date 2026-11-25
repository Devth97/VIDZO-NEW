# VIDZO conversion and visual direction

Reviewed 25 November 2026. Public-page audit of six relevant competitors, including the user-selected Creatok reference; authenticated dashboards and private conversion rates were not accessible. Changes are hypotheses to measure, not proven conversion lifts.

| Public reference | Observed pattern | VIDZO application |
| --- | --- | --- |
| [Creatify](https://creatify.ai/) | Task-specific entry points; repeated creation/demo actions | One clear draft action, visual workflow, contextual next steps |
| [Arcads](https://www.arcads.ai/) | Immediate creation and Google continuation, visual examples | Consistent CTA and uncluttered sign-in; no copied actors or promotions |
| [Higgsfield](https://higgsfield.ai/) | Media-first exploration | Editorial media and selectable directions, labeled as illustrative |
| [AdCreative.ai](https://www.adcreative.ai/) | Use-case selection | Working category filters tied to concept details |
| [Pencil](https://trypencil.com/) | Product narrative connected to buyer concerns | Visible approval, pricing and review sequence; no borrowed enterprise claims |
| [Creatok](https://www.creatok.ai/) — user-selected reference | Prominent task composer, quick-start choices and staged approvals | A real draft starter with name suggestions, private same-tab handoff to the project modal and a visible next action; no pretend chat, media generation or publishing capabilities |

## Repository references

Checked [GitHub Trending](https://github.com/trending). [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills) and [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) appeared there: useful references for intentional design systems and editorial hierarchy. No scripts or agent instructions were installed/executed.

Reviewed [shadcn/ui](https://github.com/shadcn-ui/ui) (MIT), [Magic UI](https://github.com/magicuidesign/magicui) (MIT), and [Motion](https://github.com/motiondivision/motion) for composable controls, visible states and restrained transitions. They are popular component references, not claims about today's top trend ranking. No third-party code was copied or runtime dependency added.

## Design contract

- Homepage: one **Start a free draft** action. Free means project creation, not AI generation. Secondary exploration works without sign-in.
- Warm paper, olive ink, generous typography, large asymmetric hero, numbered process and product photography. No purple glows, fabricated metrics, fake play buttons or generic repeated feature grids.
- Images are original AI-created concept stills, not customer work or video output. Functional filters and accessible details explain the distinction.
- Prices retain existing source of truth and provisional/live pricing gates. No invented discounts, free credits or subscriptions.
- Responsive at 360/768/1440px, visible keyboard focus, mobile menu closes on selection/Escape. Respect reduced motion. Eager high-priority hero, lazy below-fold images, responsive WebP and reserved image dimensions.
- Preserve auth, consent, wallet and spend gates; never imply unconfigured services are ready.

## Measurement

After consented aggregate analytics is configured, compare draft starts, sign-in completion, first saved draft and pricing-to-wallet navigation. No tracking service is introduced in this change.

## Verification

Isolated Chrome: homepage, creative directions, pricing and demo workspace at 360/768/1440px; no page overflow, broken images after load, uncaught errors or axe WCAG A/AA violations. Checked working category filters, concept dialog Escape, mobile menu close/Escape, draft CTA navigation and autofocus. Live-mode sign-in checked at the same widths; consent blocked submission until checked, then the route was intercepted to test error recovery without sending credentials or creating an account. These checks do not establish a conversion lift or verify an actual new Google login.

Three original concept images are delivered as responsive WebP assets (480/900px). Their combined six files are approximately 241 KB. Generated masters remain outside Git. Images remain explicitly illustrative and no fake output playback is presented.

Creatok follow-up: inspected its public homepage in isolated Chrome. Applied the prominent task-entry surface and quick-start choices to a draft-name form, preserving VIDZO's warm visual language. Verified suggestions, typed-name handoff to the project modal, no name in URL, preservation through the signed-out gate and `/projects?new=1` return path. Names are stored only in sessionStorage for the current tab and consumed on entering projects; no fake generation or provider call is made. Storage failure falls back to the existing project creation controls.

## Creation-first update and component system — 25 November 2026 (Claude)

**Creatok, public pages only** (homepage, /tools, /pricing, logged-out /app/agent). Patterns: a short headline; a reference- or link-first creation start; an agent that shows the settings and credit cost before each action and waits for approval; tools grouped by category; failed tasks refunded. The composer itself is login-gated and was not seen. Applied: a centered **creation composer** as the focal point. Every control in it maps to a real project field: name, goal (`brief.objective`), and optional brand and product (`brief.brand`, `brief.product`). Quick starts fill name and goal. It does not imitate a prompt-to-video box, because VIDZO needs an authorized reference and product photos first, and its footer says so ("Reference video → Product photos → Approve, then quote").

**GitHub trending, checked today** (weekly and daily, overall and TypeScript): `meta/astryx` (MIT, +2.9k stars this week) was the only trending React component system. Other UI-adjacent entries (`a2ui-project/a2ui`, `ag-ui-protocol/ag-ui`, `google-labs-code/stitch-skills`, `google-labs-code/design.md`) are agent and protocol tooling, not a fit for this UI. Nothing from them was installed.

**Meta Astryx evaluation.** MIT; React 19 peer; ships pre-built CSS and JS (StyleX peer, no build plugin); themed through CSS custom properties in cascade layers (`reset`, `astryx-base`, `astryx-theme`); beta and pre-1.0 with near-daily releases. Spike results in this repository:
- `@astryxdesign/core` and `@astryxdesign/theme-stone` are pinned to **0.7.14** (published 11 Nov, about 2 weeks old at adoption) and `@stylexjs/stylex` to 0.19.0. The core `postinstall` only prints a nudge to run `astryx init` (which writes agent docs), so it is **blocked** in `pnpm-workspace.yaml`.
- Builds and runs under both the Next.js build and the vinext/Cloudflare Workers build, with no hydration warnings in dev.
- Cost: `astryx.css` adds about **44 KB gzipped** of render-blocking CSS (total app CSS is now about 62 KB gzipped). It ships as one file, so there is no per-component CSS to trim. Revisit if Lighthouse shows LCP pressure.
- Integration: `src/app/layers.css` loads first and fixes the order `vidzo-base, reset, astryx-base, astryx-theme`. Our element defaults moved into `vidzo-base`, so they no longer override Astryx controls; VIDZO class rules stay unlayered. `src/app/astryx-theme.css` maps our beige, olive and ink tokens onto Astryx variables. `DesignSystem` wraps the app in `<Theme mode="light">` so menus rendered outside the tree are themed too.
- **Adopted selectively** where behaviour and accessibility are hardest to hand-build: `SegmentedControl` (composer goal and project status filter: radio-group semantics, arrow keys) and `DropdownMenu` (project card actions: menu semantics, focus return on Escape). Existing buttons, fields and the native `<dialog>` modal are unchanged, so the studio does not restyle mid-flow. Migrating more components is optional, case by case.

**Verified in the browser (demo mode, `pnpm dev:demo`)**
- Composer quick starts, goal arrow keys, the details disclosure, and Enter to submit.
- The full intent survives the sign-in hop: same-tab sessionStorage only, consumed once, never in the URL. The workspace composer is prefilled and focused.
- The created project carries the brief fields.
- Fixed in this pass: a **double-click created two projects**; composer and sample creation now use synchronous guards.
- The project status filter works; the card menu opens by keyboard and returns focus on Escape.
- No page overflow at 360 px. Container queries keep the composer usable inside the narrow workspace column.
- Goal-segment labels truncated on phones and were fixed by removing icons from that control.
- The studio's raw file inputs were replaced with styled, keyboard-focusable upload buttons.
- Console free of errors and hydration warnings.
