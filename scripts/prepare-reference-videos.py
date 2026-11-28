"""Prepare the user-supplied website references; originals remain untouched.

Usage: python scripts/prepare-reference-videos.py <source-directory>
Requires imageio-ffmpeg. Published previews are silent and optimized for the web.
"""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

CLIPS = [
    ("street-tote", "8mwespY-a2mgC1Vtjmj5P.mp4", 1),
    ("truck-reveal", "idRu8DcGon1kCmfEN5wV6.mp4", 1),
    ("cat-bed", "TU-A8vAfQPW4SAuAp4w_l.mp4", 10),
    ("poolside-bag", "Gt1uPWr1MmwsiyFXgDajI.mp4", 1),
    ("headphone-detail", "PIpEahpNhS9x6Hr61x_Oz.mp4", 2),
    ("web-sneakers", "spider-web-object-retrieval.mp4", 1),
    ("checkered-mug", "result.mp4", 5),
    ("bathroom-remake", "viral_cloned.mp4", 1),
    ("cleaner-demo", "result-FTNgcM2IbV2l-Ix1Sq9Y-.mp4", 1),
    ("bathroom-original", "viral_original.mp4", 1),
]

if __name__ == "__main__":
    source = Path(sys.argv[1])
    target = Path(__file__).resolve().parents[1] / "public" / "media" / "references"
    target.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    for slug, filename, poster_time in CLIPS:
        subprocess.run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source / filename),
            "-map", "0:v:0", "-an", "-vf", "scale='min(480,iw)':-2", "-r", "24",
            "-c:v", "libx264", "-preset", "medium", "-crf", "26", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(target / f"{slug}.mp4"),
        ], check=True)
        subprocess.run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(poster_time),
            "-i", str(target / f"{slug}.mp4"), "-frames:v", "1", "-q:v", "4",
            str(target / f"{slug}.jpg"),
        ], check=True)
    (target / "provenance.json").write_text(json.dumps({
        "purpose": "User-supplied visual references, not VIDZO-generated results or endorsements.",
        "processing": "Full-length silent H.264 previews, max 480px wide, 24fps, web faststart. Originals unchanged.",
        "clips": [{"asset": slug, "supplied_file": filename} for slug, filename, _ in CLIPS],
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(CLIPS)} reference videos and posters in {target}")
