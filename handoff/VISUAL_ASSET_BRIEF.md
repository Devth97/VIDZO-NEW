# GPT visual asset brief

Claude codes; GPT creates visual assets after the user requests them. No generated assets are included yet.

## Direction

Latest user direction: warm beige, premium editorial, distinctive and conversion-aware. Overrides the original dark design spec. Avoid generic dark SaaS/purple glow, crowded grids and exaggerated performance claims.

| Token | Value |
| --- | --- |
| Canvas | `#F7F5F0` |
| Surface | `#FFFEFA` |
| Soft surface | `#F0EDE5` |
| Border | `#DEDBD2` |
| Ink | `#282B25` |
| Muted text | `#6B6D62` |
| Olive primary | `#445A39` |
| Soft accent | `#C8D5AB` |

Current typography: Manrope + DM Sans with restrained italic serif emphasis. Do not bake UI copy, logos, CTA or price into generated art; use accessible HTML or exact overlays.

## Asset batches when requested

1. **Hero:** tactile product packaging, warm natural studio light, sculptural plinth, generous negative space. Landscape 1600×1200 plus optional 1080×1440 portrait crop. Current CSS bottle is a composition placeholder, not final branding.
2. **Category covers:** beauty, apparel, electronics, jewelry and packaged goods; 1200×900, consistent light/camera. No competitor branding, claims or fake campaign badges. Label illustrative until replaced with actual outputs.
3. **Storyboard:** three consistent 1080×1920 frames for the same exact product: hook/detail, product reveal/interaction, clean CTA-ready hero. Use actual supplied product photos when available. Static storyboard frames are not finished video.
4. **Characters:** original adult identities only when roles require them. One role: three alternatives; two roles: two each. Every sheet front/profile/three-quarter/full-body. Consistent identity/wardrobe; no recognizable lookalikes without permission.
5. **Product cutouts:** preserve supplied product shape, text/material/packaging; PNG with real alpha for requested transparent cutouts.

## Asset coordination

Claude supplies screen/component, exact dimensions/aspect, crop/safe area, theme, actual reference images and filename. Proposed file paths **do not exist yet**:

```text
public/assets/hero/creative-studio.webp
public/assets/covers/beauty.webp
public/assets/covers/apparel.webp
public/assets/covers/electronics.webp
public/assets/covers/jewelry.webp
public/assets/covers/packaged-goods.webp
```

Keep fallback components until files arrive. Never link nonexistent paths. Customer media belongs in private storage. Deliver final files plus dimensions, alt text, source/reference, generated/photographic status and commercial-use review status. Preserve original masters outside Git.

Still needed: actual VIDZO logo/brand approval, product/reference photos, first pilot industry/brand and the next visual batch the user wants. Coding can continue with honest placeholders.
