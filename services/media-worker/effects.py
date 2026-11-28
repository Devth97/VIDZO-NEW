"""Motion-graphics layer for the media worker, rendered with HyperFrames (Apache-2.0; HTML to video).

A style is a transparent 1080x1920 composition: an animated hook headline, an optional offer badge and an
animated CTA card. Customer text never enters the HTML: it is passed as HyperFrames composition variables
and bound with data-var-text, so it cannot become markup or script. Only numbers (timings) are written into
the page. Everything sits inside the social-safe band (168 to 1330 px) that platform UI never covers.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

STYLES = ("none", "bold")
SAFE_TOP, SAFE_BOTTOM = 168, 1330  # px on 1080x1920: platform status bar above, captions and buttons below


def ink_for(hex_color: str) -> str:
    """Near-black or white text, whichever contrasts more with the brand colour (WCAG relative luminance)."""
    def channel(v: int) -> float:
        c = v / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    lum = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    return "#111111" if (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) else "#ffffff"


def plan(total: float, has_badge: bool) -> dict:
    """Clip windows in seconds for an ad of `total` seconds: hook first, CTA last, badge in between."""
    hook = round(min(2.8, max(1.2, total * 0.35)), 3)
    cta = round(min(3.0, max(1.5, total * 0.3)), 3)
    timing = {"total": round(total, 3), "hook": hook, "cta_start": round(total - cta, 3), "cta": cta}
    gap_start, gap_end = hook + 0.3, total - cta - 0.3
    if has_badge and gap_end - gap_start >= 1.4:
        timing["badge_start"] = round(gap_start, 3)
        timing["badge"] = round(min(2.6, gap_end - gap_start), 3)
    return timing


def variables(overlay: dict) -> dict:
    brand = overlay["color"]
    return {"headline": overlay["headline"], "badge": overlay.get("badge") or "", "cta": overlay["cta"],
            "brand": brand, "ink": ink_for(brand), "accent": "#ffffff", "accentInk": "#111111"}


def bold_page(t: dict) -> str:
    badge = "badge_start" in t
    declarations = json.dumps([
        {"id": "headline", "type": "string", "label": "Hook headline", "default": "Made for your morning", "maxLength": 40},
        {"id": "badge", "type": "string", "label": "Offer badge", "default": "20% off", "maxLength": 24},
        {"id": "cta", "type": "string", "label": "Call to action", "default": "Shop now", "maxLength": 80},
        {"id": "brand", "type": "color", "label": "Brand colour", "default": "#25291f"},
        {"id": "ink", "type": "color", "label": "Text on brand", "default": "#ffffff"},
        {"id": "accent", "type": "color", "label": "Badge colour", "default": "#ffffff"},
        {"id": "accentInk", "type": "color", "label": "Text on badge", "default": "#111111"},
    ]).replace("'", "&#39;")
    badge_clip = f"""
    <div id="badge" class="clip" data-start="{t['badge_start']}" data-duration="{t['badge']}" data-track-index="1">
      <div id="badge-disc"><span id="badge-text" data-var-text="badge">20% off</span></div>
    </div>""" if badge else ""
    badge_tl = f"""
    tl.fromTo("#badge-disc", {{ opacity: 0, scale: 0.4, rotation: -24 }}, {{ opacity: 1, scale: 1, rotation: -8, duration: 0.5, ease: "back.out(2)" }}, {t['badge_start'] + 0.02});
    tl.fromTo("#badge-disc", {{ scale: 1 }}, {{ scale: 1.06, duration: 0.35, ease: "sine.inOut", yoyo: true, repeat: 1, immediateRender: false }}, {t['badge_start'] + 0.9});
    tl.to("#badge-disc", {{ opacity: 0, scale: 0.85, duration: 0.25, ease: "power2.in" }}, {round(t['badge_start'] + t['badge'] - 0.3, 3)});""" if badge else ""
    return f"""<!doctype html>
<html data-composition-variables='{declarations}'>
<head>
  <meta charset="utf-8">
  <style>
    html, body {{ margin: 0; background: transparent; }}
    #main {{ position: relative; width: 1080px; height: 1920px; overflow: hidden; background: transparent; font-family: Inter, sans-serif; }}
    #hook-card {{ position: absolute; left: 90px; right: 90px; top: {SAFE_TOP + 132}px; padding: 28px 40px; border-radius: 22px;
      background: var(--brand); color: var(--ink); font-weight: 900; font-size: 88px; line-height: 1.04; text-align: center;
      letter-spacing: -0.01em; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28); }}
    #badge-disc {{ position: absolute; right: 96px; top: 760px; width: 300px; height: 300px; border-radius: 50%;
      background: var(--accent); color: var(--accentInk); display: flex; align-items: center; justify-content: center;
      text-align: center; padding: 36px; box-sizing: border-box; font-weight: 900; font-size: 52px; line-height: 1.05;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.3); }}
    #cta-card {{ position: absolute; left: 90px; right: 90px; top: {SAFE_BOTTOM - 290}px; min-height: 150px; padding: 30px 44px;
      box-sizing: border-box; border-radius: 999px; background: var(--brand); color: var(--ink); display: flex;
      align-items: center; justify-content: center; text-align: center; font-weight: 900; font-size: 60px; line-height: 1.08;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3); }}
  </style>
</head>
<body>
  <div id="main" data-composition-id="main" data-start="0" data-duration="{t['total']}" data-width="1080" data-height="1920">
    <div id="hook" class="clip" data-start="0" data-duration="{t['hook']}" data-track-index="1">
      <div id="hook-card"><span id="hook-text" data-var-text="headline">Made for your morning</span></div>
    </div>{badge_clip}
    <div id="cta" class="clip" data-start="{t['cta_start']}" data-duration="{t['cta']}" data-track-index="1">
      <div id="cta-card"><span id="cta-text" data-var-text="cta">Shop now</span></div>
    </div>
  </div>
  <script src="assets/gsap.min.js"></script>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    tl.fromTo("#hook-card", {{ opacity: 0, y: 70, scale: 0.92 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.6)" }}, 0);
    tl.to("#hook-card", {{ opacity: 0, y: -50, duration: 0.3, ease: "power2.in" }}, {round(t['hook'] - 0.34, 3)});{badge_tl}
    tl.fromTo("#cta-card", {{ opacity: 0, y: 80, scale: 0.9 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.7)" }}, {t['cta_start'] + 0.02});
    tl.fromTo("#cta-card", {{ scale: 1 }}, {{ scale: 1.04, duration: 0.4, ease: "sine.inOut", yoyo: true, repeat: 1, immediateRender: false }}, {round(t['cta_start'] + 1.0, 3)});
    window.__timelines["main"] = tl;
  </script>
</body>
</html>
"""


def write_project(directory: Path, style: str, overlay: dict, total: float, gsap: Path) -> dict:
    """Writes the composition, its variables and a local copy of GSAP (no CDN at render time); returns timings."""
    if style != "bold":
        raise ValueError(f"Unknown effects style: {style}")
    (directory / "assets").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(gsap, directory / "assets" / "gsap.min.js")
    t = plan(total, bool(overlay.get("badge")))
    (directory / "index.html").write_text(bold_page(t), "utf-8")
    (directory / "variables.json").write_text(json.dumps(variables(overlay)), "utf-8")
    return t


def render_args(hyperframes: str, directory: Path, out: Path) -> list[str]:
    return [hyperframes, "render", "--format", "webm", "--fps", "30", "--quality", "delivery", "--strict-variables",
            "--variables-file", str(directory / "variables.json"), "-o", str(out)]


def render_env() -> dict:
    # Usage telemetry off: customer jobs never report to a third party.
    return {**os.environ, "HYPERFRAMES_NO_TELEMETRY": "1", "DO_NOT_TRACK": "1"}


def render(hyperframes: str, directory: Path, out: Path, timeout: int) -> subprocess.CompletedProcess:
    return subprocess.run(render_args(hyperframes, directory, out), cwd=directory, env=render_env(), capture_output=True,
                          timeout=timeout, check=False, stdin=subprocess.DEVNULL)
