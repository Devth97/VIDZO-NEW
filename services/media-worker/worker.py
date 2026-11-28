"""VIDZO media worker: assembles approved clips into the 1080x1920 / 30 fps H.264/AAC deliverable.

Standard library only, plus the ffmpeg and ffprobe binaries. Runs as one small container:

  POST /render                    same body -> the MP4 itself, rendered inside the request (report in the
                                  X-Vidzo-Report header, base64 JSON). For hosts that only give CPU during a
                                  request (Cloud Run request-based billing); nothing is kept afterwards.
  POST /selftest?style=bold|none  renders synthetic test clips end to end -> {ok, report} (deploy check)
  POST /jobs                      {idempotencyKey, clips[], logo?, overlay, target} -> {id, state}
  GET  /jobs?idempotencyKey=...   -> {id, state}  (reconciliation; 404 when unknown)
  GET  /jobs/<id>                 -> {id, state, error?, report?}
  GET  /jobs/<id>/result          -> the MP4 (completed jobs only)
  GET  /health                    -> {status, ffmpeg}

Every request needs `Authorization: Bearer $MEDIA_WORKER_TOKEN`. Inputs are fetched only from allowlisted
hosts over HTTPS with redirects refused and sizes capped; ffmpeg reads local files only. Jobs persist on disk,
so a restart resumes queued or interrupted work; the same idempotency key always maps to the same job.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import queue
import re
import base64
import shutil
import tempfile
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import effects

TARGET = {"width": 1080, "height": 1920, "fps": 30}
DURATION_TOLERANCE = 0.15  # seconds between the planned and the rendered length


@dataclass(frozen=True)
class Limits:
    max_clips: int = 12
    max_clip_bytes: int = 200_000_000
    max_logo_bytes: int = 10_000_000
    max_clip_seconds: float = 20.0
    max_total_seconds: float = 90.0
    max_logo_pixels: int = 4096
    fetch_timeout: int = 60
    render_timeout: int = 900
    ffmpeg_threads: int = 2
    # Address-space guard against a runaway process only. FFmpeg reserves far more virtual memory than it uses
    # (per-thread arenas and stacks), so real RAM is bounded by the container's memory limit instead.
    address_space_bytes: int = 16 * 1024**3
    output_bytes: int = 500_000_000
    retention_seconds: int = 24 * 3600
    max_body_bytes: int = 64_000


@dataclass
class Config:
    token: str
    data: Path
    input_hosts: tuple[str, ...]
    font: str
    ffmpeg: str = "ffmpeg"
    ffprobe: str = "ffprobe"
    hyperframes: str = "hyperframes"
    gsap: str = "/opt/vidzo/gsap.min.js"
    allow_loopback_http: bool = False
    limits: Limits = field(default_factory=Limits)

    @staticmethod
    def from_env() -> "Config":
        token = os.environ.get("MEDIA_WORKER_TOKEN", "")
        if len(token) < 32:
            raise SystemExit("MEDIA_WORKER_TOKEN must be set to at least 32 characters.")
        hosts = tuple(h.strip().lower() for h in os.environ.get("MEDIA_WORKER_INPUT_HOSTS", "").split(",") if h.strip())
        if not hosts:
            raise SystemExit("MEDIA_WORKER_INPUT_HOSTS must list the storage hosts clips may be fetched from.")
        return Config(
            token=token,
            data=Path(os.environ.get("MEDIA_WORKER_DATA", "/data")),
            input_hosts=hosts,
            font=os.environ.get("MEDIA_WORKER_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            ffmpeg=os.environ.get("FFMPEG", "ffmpeg"),
            ffprobe=os.environ.get("FFPROBE", "ffprobe"),
            hyperframes=os.environ.get("MEDIA_WORKER_HYPERFRAMES", "hyperframes"),
            gsap=os.environ.get("MEDIA_WORKER_GSAP", "/opt/vidzo/gsap.min.js"),
            allow_loopback_http=os.environ.get("MEDIA_WORKER_ALLOW_LOOPBACK_HTTP") == "1",
        )


class JobError(Exception):
    """A failure that is reported to the caller. Messages never include paths, URLs or tool output."""


# ------------------------------------------------------------------------------------------------
# Request validation
# ------------------------------------------------------------------------------------------------
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
KEY = re.compile(r"^[A-Za-z0-9:_-]{8,200}$")


def validate_request(body: object, limits: Limits) -> dict:
    if not isinstance(body, dict):
        raise JobError("The request must be a JSON object.")
    key = body.get("idempotencyKey")
    if not isinstance(key, str) or not KEY.match(key):
        raise JobError("idempotencyKey is missing or invalid.")
    clips = body.get("clips")
    if not isinstance(clips, list) or not 1 <= len(clips) <= limits.max_clips or not all(isinstance(c, str) and len(c) < 4096 for c in clips):
        raise JobError(f"clips must list 1 to {limits.max_clips} URLs.")
    logo = body.get("logo")
    if logo is not None and (not isinstance(logo, str) or len(logo) >= 4096):
        raise JobError("logo must be a URL.")
    target = body.get("target")
    if target != TARGET:
        raise JobError("Only the 1080x1920, 30 fps target is supported.")
    overlay = body.get("overlay") or {}
    if not isinstance(overlay, dict):
        raise JobError("overlay must be an object.")
    color = overlay.get("color") or "#25291f"
    if not isinstance(color, str) or not HEX_COLOR.match(color):
        raise JobError("overlay.color must be a #RRGGBB colour.")
    texts = {}
    for name, label, limit in (("cta", "The call to action", 80), ("headline", "The hook headline", 40), ("badge", "The offer badge", 24)):
        value = overlay.get(name) or ""
        if not isinstance(value, str) or len(value) > limit or any(ord(ch) < 32 for ch in value):
            raise JobError(f"{label} must be at most {limit} printable characters.")
        texts[name] = value.strip()
    style = overlay.get("style") or "none"
    if style not in effects.STYLES:
        raise JobError("Unknown effects style.")
    if style != "none" and not (texts["headline"] and texts["cta"]):
        raise JobError("An effects style needs a hook headline and a call to action.")
    return {"idempotencyKey": key, "clips": clips, "logo": logo, **texts, "style": style, "color": color.lower()}


def check_url(raw: str, cfg: Config) -> urllib.parse.SplitResult:
    try:
        url = urllib.parse.urlsplit(raw)
    except ValueError as e:
        raise JobError("An input URL is invalid.") from e
    host = (url.hostname or "").lower()
    loopback = cfg.allow_loopback_http and url.scheme == "http" and host in ("127.0.0.1", "localhost")
    if url.scheme != "https" and not loopback:
        raise JobError("Inputs must be fetched over HTTPS.")
    if url.username or url.password or (url.port not in (None, 443) and not loopback):
        raise JobError("An input URL is not allowed.")
    if host not in cfg.input_hosts and not loopback:
        raise JobError("An input host is not allowed.")
    return url


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: D401 - urllib hook
        raise JobError("Input redirects are not allowed.")


_opener = urllib.request.build_opener(_NoRedirect)


def fetch(raw: str, dest: Path, max_bytes: int, cfg: Config) -> int:
    check_url(raw, cfg)
    try:
        with _opener.open(urllib.request.Request(raw, headers={"User-Agent": "vidzo-media-worker"}), timeout=cfg.limits.fetch_timeout) as res:
            declared = int(res.headers.get("Content-Length") or 0)
            if declared > max_bytes:
                raise JobError("An input file is too large.")
            total = 0
            with dest.open("wb") as out:
                while chunk := res.read(1 << 20):
                    total += len(chunk)
                    if total > max_bytes:
                        raise JobError("An input file is too large.")
                    out.write(chunk)
            return total
    except JobError:
        raise
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise JobError("An input file could not be downloaded.") from e


# ------------------------------------------------------------------------------------------------
# ffprobe / ffmpeg
# ------------------------------------------------------------------------------------------------
def _limit_resources(limits: Limits):
    if sys.platform != "linux":
        return None

    def apply():
        import resource

        resource.setrlimit(resource.RLIMIT_CPU, (limits.render_timeout * limits.ffmpeg_threads, limits.render_timeout * limits.ffmpeg_threads))
        resource.setrlimit(resource.RLIMIT_AS, (limits.address_space_bytes, limits.address_space_bytes))
        resource.setrlimit(resource.RLIMIT_FSIZE, (limits.output_bytes, limits.output_bytes))
        os.nice(5)

    return apply


def run_tool(args: list[str], timeout: int, limits: Limits) -> subprocess.CompletedProcess:
    """Runs ffmpeg/ffprobe with an argument array (never a shell), bounded in time, CPU, memory and file size."""
    try:
        return subprocess.run(args, capture_output=True, timeout=timeout, check=False, stdin=subprocess.DEVNULL, preexec_fn=_limit_resources(limits))
    except subprocess.TimeoutExpired as e:
        raise JobError("Media processing took too long.") from e


def probe(path: Path, cfg: Config) -> dict:
    res = run_tool([cfg.ffprobe, "-v", "error", "-protocol_whitelist", "file", "-show_entries",
                    "format=format_name,duration:stream=codec_type,codec_name,width,height,avg_frame_rate,pix_fmt,sample_rate,channels",
                    "-of", "json", str(path)], 60, cfg.limits)
    if res.returncode != 0:
        raise JobError("A media file could not be read.")
    try:
        return json.loads(res.stdout)
    except json.JSONDecodeError as e:
        raise JobError("A media file could not be read.") from e


def summarize(info: dict) -> dict:
    streams = info.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    fmt = info.get("format") or {}
    try:
        seconds = float(fmt.get("duration") or 0)
    except ValueError:
        seconds = 0.0
    return {
        "format": fmt.get("format_name", ""), "seconds": round(seconds, 3),
        "videoCodec": video and video.get("codec_name"), "width": video and video.get("width"), "height": video and video.get("height"),
        "fps": video and video.get("avg_frame_rate"), "pixFmt": video and video.get("pix_fmt"),
        "audioCodec": audio and audio.get("codec_name"), "sampleRate": audio and audio.get("sample_rate"), "channels": audio and audio.get("channels"),
    }


def check_clip(info: dict, limits: Limits) -> dict:
    s = summarize(info)
    if not any(f in s["format"].split(",") for f in ("mov", "mp4")):
        raise JobError("Every clip must be an MP4 or MOV file.")
    if not s["videoCodec"] or not s["width"] or not s["height"]:
        raise JobError("A clip has no video track.")
    if not 0.5 <= s["seconds"] <= limits.max_clip_seconds:
        raise JobError(f"Every clip must be between 0.5 and {limits.max_clip_seconds:g} seconds long.")
    return s


def check_logo(info: dict, limits: Limits) -> dict:
    s = summarize(info)
    if s["videoCodec"] not in ("png", "mjpeg", "webp") or not s["width"] or not s["height"]:
        raise JobError("The logo must be a PNG, JPEG or WebP image.")
    if max(s["width"], s["height"]) > limits.max_logo_pixels:
        raise JobError("The logo image is too large.")
    return s


def filter_escape(value: str) -> str:
    """Escapes a value used inside an ffmpeg filter argument (paths only; text goes through a file)."""
    return value.replace("\\", "/").replace(":", "\\:").replace("'", "\\'").replace(",", "\\,").replace("[", "\\[").replace("]", "\\]")


def build_ffmpeg_args(cfg: Config, clips: list[Path], durations: list[float], out: Path, logo: Path | None, cta_file: Path | None, color: str,
                      fx: Path | None = None) -> list[str]:
    """
    One deterministic encode: each clip is scaled to cover 1080x1920 and centre-cropped, resampled to 30 fps and
    trimmed to its probed length; clip audio (and therefore any reference audio) is dropped; a silent AAC track is
    generated because no licensed music is supplied yet. An optional transparent motion-graphics layer (effects.py)
    goes over the footage; the customer's logo is composited on top, unaltered apart from proportional scaling.
    Without effects, the CTA is drawn from a text file (never parsed as filter syntax) for the last 3 seconds,
    inside the social-safe band that platform UI does not cover.
    """
    w, h, fps = TARGET["width"], TARGET["height"], TARGET["fps"]
    total = round(sum(durations), 3)
    args = [cfg.ffmpeg, "-hide_banner", "-nostdin", "-y", "-v", "error"]
    for c in clips:
        args += ["-protocol_whitelist", "file", "-i", str(c)]
    index = len(clips)
    fx_index = logo_index = None
    if fx:
        fx_index, index = index, index + 1
        args += ["-protocol_whitelist", "file", "-c:v", "libvpx-vp9", "-i", str(fx)]  # libvpx keeps the alpha channel
    if logo:
        logo_index, index = index, index + 1
        args += ["-protocol_whitelist", "file", "-loop", "1", "-t", f"{total}", "-i", str(logo)]
    audio_index = index
    args += ["-f", "lavfi", "-t", f"{total}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"]

    chains = [f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps},setsar=1,format=yuv420p,"
              f"trim=duration={d:.3f},setpts=PTS-STARTPTS[v{i}]" for i, d in enumerate(durations)]
    chains.append("".join(f"[v{i}]" for i in range(len(clips))) + f"concat=n={len(clips)}:v=1:a=0[base]")
    last = "base"
    if fx_index is not None:
        chains.append(f"[{fx_index}:v]format=yuva420p[fx]")
        chains.append(f"[{last}][fx]overlay=x=0:y=0:shortest=1:format=auto[withfx]")
        last = "withfx"
    if logo_index is not None:
        chains.append(f"[{logo_index}:v]scale=w=260:h=260:force_original_aspect_ratio=decrease,format=rgba[logo]")
        chains.append(f"[{last}][logo]overlay=x=W-w-64:y=72:shortest=1:format=auto[withlogo]")
        last = "withlogo"
    if cta_file:
        start = max(0.0, total - 3.0)
        chains.append(f"[{last}]drawtext=fontfile='{filter_escape(cfg.font)}':textfile='{filter_escape(str(cta_file))}':expansion=none:"
                      f"fontsize=64:fontcolor=white:box=1:boxcolor={color}@0.9:boxborderw=28:x=(w-text_w)/2:y={effects.SAFE_BOTTOM}-text_h-160:"
                      f"enable='gte(t\\,{start:.3f})'[cta]")
        last = "cta"
    chains.append(f"[{last}]format=yuv420p[vout]")
    threads = str(cfg.limits.ffmpeg_threads)
    args += ["-filter_threads", threads, "-filter_complex_threads", threads, "-filter_complex", ";".join(chains), "-map", "[vout]", "-map", f"{audio_index}:a",
             "-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-level:v", "4.2", "-pix_fmt", "yuv420p",
             "-r", str(fps), "-g", str(fps * 2), "-crf", "20", "-threads", threads,
             "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
             "-t", f"{total}", "-movflags", "+faststart", "-map_metadata", "-1", str(out)]
    return args


def check_output(info: dict, planned_seconds: float) -> dict:
    s = summarize(info)
    problems = []
    if s["videoCodec"] != "h264":
        problems.append("video codec is not H.264")
    if (s["width"], s["height"]) != (TARGET["width"], TARGET["height"]):
        problems.append("frame size is not 1080x1920")
    if s["fps"] not in ("30/1", "30"):
        problems.append("frame rate is not 30 fps")
    if s["pixFmt"] != "yuv420p":
        problems.append("pixel format is not yuv420p")
    if s["audioCodec"] != "aac":
        problems.append("audio codec is not AAC")
    if abs(s["seconds"] - planned_seconds) > DURATION_TOLERANCE:
        problems.append("duration does not match the approved clips")
    if problems:
        raise JobError("The rendered file failed technical checks: " + "; ".join(problems) + ".")
    return s


# ------------------------------------------------------------------------------------------------
# Job store and execution
# ------------------------------------------------------------------------------------------------
class Store:
    """One directory per job; writes are atomic renames so a crash never leaves half-written state."""

    def __init__(self, root: Path):
        self.jobs = root / "jobs"
        self.keys = root / "keys"
        self.jobs.mkdir(parents=True, exist_ok=True)
        self.keys.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()

    def _key_file(self, key: str) -> Path:
        return self.keys / hashlib.sha256(key.encode()).hexdigest()

    def dir(self, job_id: str) -> Path:
        if not re.fullmatch(r"[0-9a-f]{32}", job_id):
            raise KeyError(job_id)
        return self.jobs / job_id

    def read(self, job_id: str) -> dict:
        try:
            return json.loads((self.dir(job_id) / "job.json").read_text("utf-8"))
        except (OSError, ValueError, KeyError) as e:
            raise KeyError(job_id) from e

    def write(self, job: dict) -> None:
        d = self.dir(job["id"])
        d.mkdir(exist_ok=True)
        tmp = d / "job.json.tmp"
        tmp.write_text(json.dumps(job), "utf-8")
        os.replace(tmp, d / "job.json")

    def by_key(self, key: str) -> dict | None:
        try:
            return self.read(self._key_file(key).read_text("utf-8").strip())
        except (OSError, KeyError):
            return None

    def create(self, request: dict) -> tuple[dict, bool]:
        """Returns the job for this idempotency key, creating it only if none exists."""
        with self.lock:
            existing = self.by_key(request["idempotencyKey"])
            if existing:
                return existing, False
            job = {"id": uuid.uuid4().hex, "idempotencyKey": request["idempotencyKey"], "state": "queued", "request": request,
                   "createdAt": time.time(), "updatedAt": time.time()}
            self.write(job)
            tmp = self._key_file(request["idempotencyKey"]).with_suffix(".tmp")
            tmp.write_text(job["id"], "utf-8")
            os.replace(tmp, self._key_file(request["idempotencyKey"]))
            return job, True

    def update(self, job_id: str, **patch) -> dict:
        with self.lock:
            job = self.read(job_id)
            job.update(patch, updatedAt=time.time())
            self.write(job)
            return job

    def all(self) -> list[dict]:
        out = []
        for d in self.jobs.iterdir():
            try:
                out.append(self.read(d.name))
            except KeyError:
                continue
        return out

    def purge(self, older_than: float) -> None:
        for job in self.all():
            if job["state"] in ("completed", "failed") and job["updatedAt"] < older_than:
                shutil.rmtree(self.dir(job["id"]), ignore_errors=True)
                self._key_file(job["idempotencyKey"]).unlink(missing_ok=True)


def public_view(job: dict) -> dict:
    view = {"id": job["id"], "state": job["state"]}
    if job.get("error"):
        view["error"] = job["error"]
    if job.get("report"):
        view["report"] = job["report"]
    return view


def ffmpeg_version(cfg: Config) -> str:
    try:
        res = subprocess.run([cfg.ffmpeg, "-version"], capture_output=True, timeout=10, check=False)
        return res.stdout.decode("utf-8", "replace").splitlines()[0] if res.returncode == 0 else "unavailable"
    except (OSError, subprocess.TimeoutExpired):
        return "unavailable"


def render(job: dict, cfg: Config, work: Path) -> dict:
    """Downloads the request's inputs into `work`, then assembles them."""
    req = job["request"]
    if work.exists():
        shutil.rmtree(work)  # a restart redoes the whole render; output is deterministic
    work.mkdir(parents=True)
    clips = []
    for i, url in enumerate(req["clips"]):
        p = work / f"clip{i}.mp4"
        fetch(url, p, cfg.limits.max_clip_bytes, cfg)
        clips.append(p)
    logo = None
    if req.get("logo"):
        logo = work / "logo.img"
        fetch(req["logo"], logo, cfg.limits.max_logo_bytes, cfg)
    return assemble(job["id"], req, cfg, work, clips, logo)


def assemble(job_id: str, req: dict, cfg: Config, work: Path, clips: list[Path], logo: Path | None) -> dict:
    """Checks local inputs, renders the effects layer if any, encodes, verifies and moves the result next to `work`."""
    inputs = [check_clip(probe(p, cfg), cfg.limits) for p in clips]
    durations = [c["seconds"] for c in inputs]
    if sum(durations) > cfg.limits.max_total_seconds:
        raise JobError(f"The finished ad would be longer than {cfg.limits.max_total_seconds:g} seconds.")
    if logo:
        check_logo(probe(logo, cfg), cfg.limits)
    cta = fx = None
    if req.get("style", "none") != "none":
        fx_dir, fx = work / "fx", work / "fx.webm"
        effects.write_project(fx_dir, req["style"], req, round(sum(durations), 3), Path(cfg.gsap))
        try:
            res = effects.render(cfg.hyperframes, fx_dir, fx, cfg.limits.render_timeout)
        except subprocess.TimeoutExpired as e:
            raise JobError("Rendering the motion graphics took too long.") from e
        if res.returncode != 0 or not fx.is_file():
            print(f"[media-worker] effects render failed for {job_id}: {(res.stdout + res.stderr).decode('utf-8', 'replace')[-2000:]}", file=sys.stderr)
            raise JobError("Rendering the motion graphics failed.")
    elif req.get("cta"):
        cta = work / "cta.txt"
        cta.write_text(req["cta"], "utf-8")
    out = work / "out.mp4"
    args = build_ffmpeg_args(cfg, clips, durations, out, logo, cta, req["color"], fx)
    res = run_tool(args, cfg.limits.render_timeout, cfg.limits)
    if res.returncode != 0 or not out.exists():
        print(f"[media-worker] ffmpeg failed for {job_id}: {res.stderr.decode('utf-8', 'replace')[-2000:]}", file=sys.stderr)
        raise JobError("Assembly failed while encoding.")
    output = check_output(probe(out, cfg), sum(durations))
    decode = run_tool([cfg.ffmpeg, "-v", "error", "-xerror", "-protocol_whitelist", "file", "-i", str(out), "-f", "null", "-"], cfg.limits.render_timeout, cfg.limits)
    if decode.returncode != 0 or decode.stderr.strip():
        raise JobError("The rendered file did not decode cleanly.")
    final = work.parent / "result.mp4"
    os.replace(out, final)
    shutil.rmtree(work, ignore_errors=True)  # drop customer inputs as soon as the deliverable exists
    upscaled = any(c["width"] < TARGET["width"] or c["height"] < TARGET["height"] for c in inputs)
    return {
        "output": {**output, "bytes": final.stat().st_size},
        "inputs": [{k: c[k] for k in ("seconds", "width", "height", "videoCodec")} for c in inputs],
        "upscaled": upscaled,
        "audio": "Silent AAC track: no licensed music supplied; clip and reference audio excluded.",
        "overlay": {"logo": bool(logo), "cta": bool(cta or fx), "effects": req.get("style", "none")},
        "encoder": {"ffmpeg": ffmpeg_version(cfg), "video": "libx264 high@4.2 crf 20 yuv420p, 30 fps, GOP 60", "audio": "aac 128k 48 kHz stereo"},
    }


def selftest(cfg: Config, work: Path, style: str) -> dict:
    """
    End-to-end check of a deployed worker with no customer data and no network: synthesises a portrait and a
    landscape test-pattern clip plus a plain logo with ffmpeg, then runs the normal assembly, effects included.
    """
    work.mkdir(parents=True, exist_ok=True)
    clips = []
    for i, (size, seconds) in enumerate((("720x1280", 2), ("1280x720", 3))):
        p = work / f"clip{i}.mp4"
        res = run_tool([cfg.ffmpeg, "-v", "error", "-f", "lavfi", "-i", f"testsrc2=size={size}:rate=24:duration={seconds}",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", str(p)], 120, cfg.limits)
        if res.returncode != 0:
            raise JobError("Could not create the test clips.")
        clips.append(p)
    logo = work / "logo.png"
    if run_tool([cfg.ffmpeg, "-v", "error", "-f", "lavfi", "-i", "color=c=white:size=400x200", "-frames:v", "1", str(logo)], 60, cfg.limits).returncode != 0:
        raise JobError("Could not create the test logo.")
    req = {"cta": "Shop the test bottle", "headline": "Self-test headline", "badge": "Test offer", "style": style, "color": "#c8f169"}
    return assemble("selftest", req, cfg, work, clips, logo)


class Runner:
    """Processes one job at a time. Jobs left queued or running by a previous process are resumed on start."""

    def __init__(self, cfg: Config, store: Store):
        self.cfg, self.store, self.queue = cfg, store, queue.Queue()

    def start(self) -> None:
        for job in sorted(self.store.all(), key=lambda j: j["createdAt"]):
            if job["state"] in ("queued", "running"):
                self.queue.put(job["id"])
        threading.Thread(target=self._loop, daemon=True).start()

    def submit(self, job_id: str) -> None:
        self.queue.put(job_id)

    def process(self, job_id: str) -> dict:
        job = self.store.update(job_id, state="running", error=None)
        try:
            report = render(job, self.cfg, self.store.dir(job_id) / "work")
            return self.store.update(job_id, state="completed", report=report)
        except JobError as e:
            return self.store.update(job_id, state="failed", error=str(e))
        except Exception as e:  # unexpected: fail closed without leaking details
            print(f"[media-worker] unexpected error for {job_id}: {e!r}", file=sys.stderr)
            return self.store.update(job_id, state="failed", error="Assembly failed unexpectedly.")
        finally:
            shutil.rmtree(self.store.dir(job_id) / "work", ignore_errors=True)

    def _loop(self) -> None:
        last_purge = 0.0
        while True:
            try:
                job_id = self.queue.get(timeout=60)
                if self.store.read(job_id)["state"] in ("queued", "running"):
                    self.process(job_id)
            except queue.Empty:
                pass
            except KeyError:
                continue
            if time.time() - last_purge > 3600:
                self.store.purge(time.time() - self.cfg.limits.retention_seconds)
                last_purge = time.time()


# ------------------------------------------------------------------------------------------------
# HTTP
# ------------------------------------------------------------------------------------------------
def make_handler(cfg: Config, store: Store, runner: Runner):
    class Handler(BaseHTTPRequestHandler):
        server_version = "vidzo-media-worker"
        sys_version = ""

        def log_message(self, fmt, *args):  # request lines only; no query strings (they may hold keys)
            sys.stderr.write(f"[media-worker] {self.command} {urllib.parse.urlsplit(self.path).path} {args[1] if len(args) > 1 else ''}\n")

        def _json(self, status: int, body: dict) -> None:
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _authorized(self) -> bool:
            given = self.headers.get("Authorization", "")
            if hmac.compare_digest(given.encode(), f"Bearer {cfg.token}".encode()):
                return True
            self._json(HTTPStatus.UNAUTHORIZED, {"error": "Unauthorized."})
            return False

        def do_GET(self):  # noqa: N802 - http.server API
            url = urllib.parse.urlsplit(self.path)
            if url.path == "/health":
                return self._json(HTTPStatus.OK, {"status": "ok", "ffmpeg": ffmpeg_version(cfg) != "unavailable"})
            if not self._authorized():
                return None
            parts = [p for p in url.path.split("/") if p]
            if parts == ["jobs"]:
                key = urllib.parse.parse_qs(url.query).get("idempotencyKey", [""])[0]
                job = store.by_key(key) if key else None
                return self._json(HTTPStatus.OK, public_view(job)) if job else self._json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            if len(parts) in (2, 3) and parts[0] == "jobs":
                try:
                    job = store.read(parts[1])
                except KeyError:
                    return self._json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
                if len(parts) == 2:
                    return self._json(HTTPStatus.OK, public_view(job))
                if parts[2] == "result" and job["state"] == "completed":
                    return self._send_file(store.dir(job["id"]) / "result.mp4")
            return self._json(HTTPStatus.NOT_FOUND, {"error": "Not found."})

        def _render_now(self, request: dict) -> None:
            tmp = Path(tempfile.mkdtemp(prefix="render-", dir=cfg.data if cfg.data.is_dir() else None))
            try:
                report = render({"id": "sync", "request": request}, cfg, tmp / "work")
            except JobError as e:
                shutil.rmtree(tmp, ignore_errors=True)
                return self._json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": str(e)})
            except Exception as e:  # unexpected: fail closed without leaking details
                shutil.rmtree(tmp, ignore_errors=True)
                print(f"[media-worker] unexpected render error: {e!r}", file=sys.stderr)
                return self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Assembly failed unexpectedly."})
            try:
                header = base64.b64encode(json.dumps(report).encode()).decode()
                self._send_file(tmp / "result.mp4", {"X-Vidzo-Report": header})
            finally:
                shutil.rmtree(tmp, ignore_errors=True)

        def _send_file(self, path: Path, extra: dict | None = None) -> None:
            size = path.stat().st_size
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "video/mp4")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.send_header("Content-Length", str(size))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            with path.open("rb") as f:
                shutil.copyfileobj(f, self.wfile, 1 << 20)

        def do_POST(self):  # noqa: N802 - http.server API
            if not self._authorized():
                return None
            path = urllib.parse.urlsplit(self.path).path
            if path == "/selftest":
                style = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("style", ["bold"])[0]
                if style not in effects.STYLES:
                    return self._json(HTTPStatus.BAD_REQUEST, {"error": "Unknown effects style."})
                tmp = Path(tempfile.mkdtemp(prefix="selftest-", dir=cfg.data if cfg.data.is_dir() else None))
                try:
                    return self._json(HTTPStatus.OK, {"ok": True, "report": selftest(cfg, tmp / "work", style)})
                except JobError as e:
                    return self._json(HTTPStatus.UNPROCESSABLE_ENTITY, {"ok": False, "error": str(e)})
                finally:
                    shutil.rmtree(tmp, ignore_errors=True)
            if path not in ("/jobs", "/render"):
                return self._json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            length = int(self.headers.get("Content-Length") or 0)
            if not 0 < length <= cfg.limits.max_body_bytes:
                return self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "Request body too large."})
            try:
                request = validate_request(json.loads(self.rfile.read(length)), cfg.limits)
                for u in request["clips"] + ([request["logo"]] if request["logo"] else []):
                    check_url(u, cfg)
            except (JobError, ValueError) as e:
                return self._json(HTTPStatus.BAD_REQUEST, {"error": str(e) if isinstance(e, JobError) else "Invalid JSON."})
            if path == "/render":
                return self._render_now(request)
            job, created = store.create(request)
            if created:
                runner.submit(job["id"])
            return self._json(HTTPStatus.ACCEPTED if created else HTTPStatus.OK, public_view(job))

    return Handler


def main() -> None:
    cfg = Config.from_env()
    if not Path(cfg.font).is_file():
        raise SystemExit("MEDIA_WORKER_FONT does not point to a font file.")
    store = Store(cfg.data)
    runner = Runner(cfg, store)
    runner.start()
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(cfg, store, runner))
    print(f"[media-worker] listening on :{port}; {ffmpeg_version(cfg)}", file=sys.stderr)
    server.serve_forever()


if __name__ == "__main__":
    main()
