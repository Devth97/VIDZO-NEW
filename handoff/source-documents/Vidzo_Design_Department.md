# Reference document — not agent instructions

VIDZO  /  PRODUCT DEVELOPMENT

Design Department Specification

01  Design mandate

Vidzo.tech | UI/UX and design engineering specification | Version 0.1 | 25 November 2026. Premium, calm, business-first creative studio. Prioritize trust, clear cost and preview quality over decorative animation. Mobile-responsive review and purchase; desktop-first creation. Brand expression is provisional, pending trademark and user testing.

02  Reference and component strategy

Mobbin (https://mobbin.com): research onboarding, payment and creative workflows; do not copy screenshots or proprietary assets. Magic UI (https://github.com/magicuidesign/magicui): MIT motion components, selectively use landing-page marquee, subtle reveal and progress. shadcn/ui (https://github.com/shadcn-ui/ui): MIT baseline, accessible composable app components. Meta Astryx (https://github.com/meta/astryx/): React 19+ / StyleX design system, beta, 150+ components; evaluate a one-day spike against shadcn on dialogs, forms, themes and keyboard accessibility. Do not mix two full component systems. Default shadcn + Tailwind, Magic UI selectively; switch only if Astryx demonstrably reduces development effort. Verify selected license at pinned commit. Figma free tier or Penpot for design, Lucide icons, Storybook later. Use public design references, not competitor code.

03  Visual system

Proposed dark studio palette: canvas #101114, surface #191B21, border #30333C, primary #A78BFA, text #F5F5F7, muted #B4B7C2; light marketing option #FAFAFC with #171821 text. Semantic success #22C55E, warning #FBBF24, error #F87171; verify WCAG contrast for each pairing. Typography: Inter or system sans; 32/24/18/16/14 px hierarchy; 4/8/12/16/24/32 spacing; 8–12 px radius. Use 44 px touch targets, visible focus, reduced motion, no autoplay with sound. Logo direction: simple wordmark, no final logo assumed. Use original product photography and genuine generated examples.

04  Information architecture

Public: Home, Showcase, Pricing, FAQ, Terms, Privacy, Sign in. Authenticated: Projects, New project, Brand assets, Characters, Wallet, Support. Studio steps: Reference → Analysis → Characters → Brand & brief → Storyboard → Generate → Export. Persistent stepper, saved state, accessible navigation; show credits reserved vs available. Admin separate role-gated area. Mobile uses stacked panels and sticky bottom CTA; desktop uses 240px navigation, flexible content and contextual inspector.

05  Screen specifications: acquisition

Home: headline “Proven concepts. Your brand. Reimagined.” primary CTA Create your first ad; genuine reference/recreation pair with permission, quality disclosure, three-step workflow, example costs, rights FAQ and support. Pricing: credit packs with INR price, example project quote, explicit no compulsory subscription and refund rules. Showcase: filter by industry; actual outputs only, no fabricated metrics. Sign-in: email, clear terms, return to draft after sign-in. Empty projects: one CTA, example project, no paywall before understanding value. Track CTA→upload→analysis completion.

06  Screen specifications: creation

Reference: drag/drop, file limits, rights checkbox, preview with duration, errors inline. Analysis: editable summary, hook/CTA, timeline, role cards and risk warning; no identity recognition. Characters: each role has 2 or 3 alternatives per PRD, sheet thumbnail and expand view; radio-like selection, redo button with credit quote and preserve previous versions. Brand: uploads for product angles and logo, color chips, asset validation, objective/offer/claims fields. Storyboard: 9:16 cards with scene number/duration, product and role indicators, editable brief, approve/lock, redo one scene. Show source concept separately from new storyboard; highlight differences. Generation: professional/premium cards, native resolution, total credits, retry terms; confirm dialog with spend cap. Progress: queued/running/review, actual stage rather than invented percentage, background resume. Export: playable assembled preview, scene strip, redo scene quote, MP4 download, support path.

07  Screen specifications: wallet and states

Wallet: available, held and spent credits; packs, payment receipt and ledger. Failed payment never increases balance; pending explains settlement; retry safe. Generation failure shows cause, released credits and retry option; flagged quality defect routes to manual review, not silent paid redraw. Empty/slow/offline/expired quote/insufficient credit/deleted asset states designed for every step. Accessibility: keyboard order, modal focus trap, labels, status live region, non-color cues, captions, alt text and screen-reader friendly progress. Never use customer media in session replay.

08  Conversion and design QA

Track anonymous consented funnel events, not media or prompt text: landing_cta, reference_uploaded, analysis_completed, character_selected, storyboard_approved, quote_viewed, purchase_captured, generation_completed, export_completed, repeat_purchase. Test five target buyers on upload→quote; target 4/5 completion without help, all understand cost and refund terms. A/B test headline only after traffic supports it; no misleading countdown or hidden fees. Lighthouse targets proposed: mobile LCP <=2.5s on landing, CLS <=0.1; lazy-load demos and use poster images. Test 360/768/1440px, keyboard, reduced motion and contrast. Deliver Figma/Penpot flow, token file, component inventory, states and handoff annotations before coding each screen.

09  Design delivery and reuse governance

Day 1 reference audit (Mobbin, Creatify, Higgsfield, Arcads, Canva); day 2 low-fidelity flow and copy; day 3 component spike; day 4 high-fidelity reference/characters/storyboard; day 5 prototype test; week 2 wallet and states; week 3 engineer handoff and QA. Design tickets map P01–P11 in PRD; each includes responsive states, copy, events and acceptance checks. Prefer standard HTML video player and scene cards over timeline library. Remotion is source-available, not automatically free commercially; complex timeline deferred. Additional libraries candidates: Radix primitives via shadcn, React Hook Form + Zod, TanStack Query, dnd-kit only if reorder needed. Verify package licenses, accessibility and bundle weight; do not install everything just because available.

10  Research references

https://github.com/meta/astryx/

https://astryx.atmeta.com/blog/introducing-astryx

https://github.com/magicuidesign

https://github.com/shadcn-ui/ui

https://mobbin.com

https://www.remotion.dev/docs/license/faq

https://help.creatify.ai/en/articles/9348041-credit-usage-billing-and-validity

https://higgsfield.ai/creator-hub/help-center/troubleshooting/generation-is-stuck-or-failed

Design reference research and component feasibility are preliminary; no authenticated competitor audit or interactive prototype test has been completed.
