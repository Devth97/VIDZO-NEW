# Asset requests for GPT — 25 November 2026 (from Claude)

Context: the homepage is now creation-first. A centered composer sits above a compact "Need a direction?" strip that shows the concept stills **cropped to 4:3**; the full creative-directions page and dialogs still show them at **4:5**. Palette: canvas `#F7F5F0`, warm white `#FFFEFA`, soft `#F0EDE5`, ink `#282B25`, olive `#445A39`, sage `#C8D5AB`. Keep the editorial, warm, tactile studio-light look of the existing three stills in `public/assets/concepts/` (ritual, sound, form).

Rules for every asset: original work only, with no competitor branding, real people, logos, text, prices or claims baked into the image. These are labelled "AI concept still · not video or customer work" in the UI. Deliver masters outside Git; send the optimized files below plus alt text, generated/photographic status and commercial-use review status.

## 1. Favicon and app icon (needed now: production logs a favicon 404)

| File | Size | Notes |
| --- | --- | --- |
| `public/favicon.ico` | 16, 32, 48 multi-size | Must read at 16 px |
| `public/icon.svg` | vector, square | Same mark as below, no text |
| `public/apple-touch-icon.png` | 180×180 | Opaque `#F7F5F0` background, ~12% padding |
| `public/icon-512.png` | 512×512 | Opaque background, for the web manifest |

Use the current provisional wordmark symbol (the aperture/spark mark in the header) as the starting point, simplified for small sizes: olive `#445A39` on `#F7F5F0`. Provisional brand only, pending trademark review.

## 2. Two concept stills to complete the category filters

The filters currently cover Beauty, Electronics and Jewelry. The PRD's verticals also include **Apparel** and **Packaged goods**.

| File | Subject | Direction |
| --- | --- | --- |
| `public/assets/concepts/thread-900.webp` + `thread-480.webp` | Apparel: a folded knit or linen garment, fabric texture in raking light | Warm linen tones, one sculptural paper prop, generous negative space |
| `public/assets/concepts/pantry-900.webp` + `pantry-480.webp` | Packaged goods: an unbranded jar or pouch (blank label) with one ingredient prop | Morning light, travertine or wood surface, calm and appetising |

- **Dimensions:** 900×1125 and 480×600 (4:5 portrait), WebP, quality around 78, each under 70 KB at 900 px.
- **Safe area:** keep the product and all key detail inside the **central 4:3 band** (the middle 900×675 of the 900×1125 frame). The discovery strip crops top and bottom; nothing important may sit in the top or bottom 225 px.
- Leave the label areas blank: no fake brand names or readable text.
- Provide alt text (about 12 words) and a one-line "direction" sentence for each, matching the tone of the existing three.

When delivered, Claude adds them to `src/components/concept-image.tsx` and the filter list.
