# VIDZO — handoff to ChatGPT (visual direction and assets)

Prepared 25 November 2026 by Claude. Roles: **ChatGPT owns visual direction and asset generation. Claude owns code** (integration, responsive sources, alt text, labels, deployment). Paste this whole file into ChatGPT; it is self-contained.

## 1. What VIDZO is

A B2B studio that turns an **authorized** reference ad concept into a distinct 10–15 second vertical (9:16) product ad. Customers use their **real product photos, exact logo and original characters**, and approve every storyboard frame and a credit quote before any paid generation. Buyers: agencies, D2C brands, dropshippers. Verticals: beauty, apparel, electronics, jewelry, packaged goods.

Live site: **https://vidzo.tech** (private beta). AI generation and payments are not switched on yet.

## 2. Current state of the UI (live)

- **Homepage:** a short centered headline ("Good inspiration. Distinctly *your ad.*"), then a large white **creation panel** (name your ad, pick a goal, optional brand and product, then "Start a free draft"), quick-start chips, and a compact **"Need a direction?"** strip showing concept stills **cropped to 4:3**. Below that: the process, a pricing preview, FAQ and a final call to action.
- **Creative directions page** (`/showcase`): the same stills at **4:5** with category filters (All, Beauty, Electronics, Jewelry) and a detail dialog.
- **Workspace** (`/projects`, after Google sign-in): the same creation panel, a "continue" card, and a grid of project cards. Each card cover is currently a **CSS-drawn placeholder bottle labelled "forma"**. That implies a product the customer doesn't have, and replacing it is request P3 below.
- **Studio:** seven steps (Reference → Analysis → Characters → Brand & brief → Storyboard → Generate → Export). Customer media stays private and is never used as marketing imagery.

## 3. Visual system (keep it)

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#F7F5F0` | page background (warm paper) |
| Surface | `#FFFEFA` | cards, panels |
| Soft surface | `#F0EDE5` | chips, image wells |
| Border | `#DEDBD2` | hairlines |
| Ink | `#282B25` | text, dark buttons |
| Muted | `#6B6D62` | secondary text |
| Olive | `#445A39` | primary actions, accents |
| Sage | `#C8D5AB` | soft highlights |

Type: Manrope (headings, tight tracking), DM Sans (body), Georgia italic for single emphasised words. Mood: **premium editorial, warm studio light, tactile materials (travertine, paper, linen, satin), generous negative space.** The established look is set by the three existing stills: an olive serum bottle on sunlit travertine, cream headphones on curved terracotta paper, and a gold cuff on dark stone and ivory satin.

**Never:** dark SaaS with purple glow, competitor branding or screenshots, real or recognisable people, readable text, logos, prices, claims or fake UI baked into images, fake play buttons, or anything presented as a customer result or VIDZO video output. All current imagery is labelled *"AI-created concept still · not video or customer work."*

## 4. Requests, in priority order

### P1 — Favicon and app icon (production currently returns a 404 for the favicon)

| File | Size | Notes |
| --- | --- | --- |
| `public/favicon.ico` | 16, 32, 48 multi-size | Must stay legible at 16 px |
| `public/icon.svg` | square vector | No text |
| `public/apple-touch-icon.png` | 180×180 | Opaque `#F7F5F0` background, about 12% padding |
| `public/icon-512.png` | 512×512 | Opaque background (web manifest) |

Mark: simplify the current provisional aperture/spark symbol shown before the "vidzo." wordmark into an olive `#445A39` mark on `#F7F5F0`. Provisional, pending trademark review.

### P2 — Two concept stills to complete the category filters

| Files | Subject | Direction |
| --- | --- | --- |
| `public/assets/concepts/thread-900.webp`, `thread-480.webp` | **Apparel**: a folded knit or linen garment, fabric texture in raking light | Warm linen tones, one sculptural paper prop |
| `public/assets/concepts/pantry-900.webp`, `pantry-480.webp` | **Packaged goods**: an unbranded jar or pouch with a blank label, plus one ingredient prop | Morning light, travertine or wood |

- Size: **900×1125 and 480×600 (4:5)**, WebP at around quality 78, under 70 KB at 900 px.
- **Safe area: everything important inside the central 4:3 band** (the middle 900×675). The homepage crops the top and bottom 225 px.
- For each image, also provide alt text (about 12 words), a title in the existing voice (e.g. "A daily ritual, reframed.") and a one-sentence direction.

### P3 — Neutral project-card covers, replacing the fake "forma" bottle

Covers for projects that don't have a customer frame yet. They must **not depict any product**, because the project belongs to the customer.

- Four abstract editorial material studies sharing one camera and light setup: travertine, ivory paper fold, linen weave, olive-tinted plaster.
- Files: `public/assets/covers/cover-1-640.webp` … `cover-4-640.webp` at **640×480 (4:3)**, plus `-1280` versions at 1280×960; under 40 KB each at 640.
- Keep the **top-left 40% × 25%** and **bottom-right 35% × 20%** calm and low-contrast: status and format badges sit there.

### Later (ask before starting)

Storyboard placeholder frames (1080×1920), character-sheet layout guidance, and pricing or process illustrations. Don't start these until the user asks.

## 5. Delivery

1. Hand the optimized files to the user (or Claude) with the exact filenames above. Keep the generated masters outside Git.
2. For each file, give: filename, dimensions, file size, alt text, AI-generated or photographic, and a note that commercial-use review is pending.
3. Claude integrates them: wires responsive `srcset`, adds the stills to the filter list and the covers to project cards, keeps the "concept still" labels, adds the favicon and manifest links, then verifies at 360/768/1440 px and deploys through GitHub.

**Acceptance:** palette and light match the existing three stills; nothing readable or branded in any image; safe areas respected; size budgets met; the favicon reads clearly at 16 px.

## 6. References in the repository

- `handoff/GPT_ASSET_BRIEF_20261125.md`: the P1/P2 brief in short form.
- `handoff/VISUAL_ASSET_BRIEF.md`: the original asset brief (some sizes there are superseded by this file).
- `public/assets/concepts/README.md`: provenance for the existing stills.
- `docs/UI_RESEARCH.md`: UI research and design decisions (Creatok structure, the Astryx component system).
