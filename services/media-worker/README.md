# VIDZO media worker

Assembles a customer's current, approved clips into the delivery file. It is one Python process: the standard library plus the `ffmpeg` and `ffprobe` binaries. The app talks to it through `src/lib/server/providers/worker.ts`.

## What it produces

- 1080 × 1920, 30 fps, H.264 High (yuv420p, CRF 20, 2-second GOP), `+faststart` MP4.
- AAC 128 kb/s, 48 kHz stereo. The track is **silence**, because no licensed music is supplied yet. Clip audio, and so any reference audio, is never mapped.
- Each clip is scaled to cover the frame, centre-cropped, resampled to 30 fps and trimmed to its probed length. Clips are then concatenated in the order given.
- The customer's logo is composited top-right. Its only change is proportional scaling to fit 260 × 260 px.
- The CTA is drawn for the final 3 seconds, in DejaVu Sans Bold on the brand colour. The text goes to FFmpeg through a file with `expansion=none`, so it is never parsed as filter syntax. At most 80 characters; the app blocks longer ones at quote time.
- Every output is checked before it is offered:
  - ffprobe confirms codec, size, frame rate, pixel format, audio codec, and duration within 0.15 s of the clips.
  - A full decode pass (`-xerror`) must finish with no errors.
- A technical report is returned with each job and stored on the export asset (`meta.assembly`). It records:
  - the input sizes and whether anything was upscaled
  - the encoder settings and the FFmpeg version line

## API

All routes except `/health` need `Authorization: Bearer $MEDIA_WORKER_TOKEN`.

| Route | Result |
| --- | --- |
| `POST /jobs` with `{idempotencyKey, clips[], logo?, overlay: {cta, color}, target: {width:1080,height:1920,fps:30}}` | `202 {id, state}` for a new job. `200` with the same job when the key was seen before. |
| `GET /jobs?idempotencyKey=…` | The job for that key, or `404`. The app uses this to reconcile an unanswered submission. |
| `GET /jobs/<id>` | `{id, state: queued \| running \| completed \| failed, error?, report?}`. Errors are customer-safe messages. |
| `GET /jobs/<id>/result` | The MP4, completed jobs only. |
| `GET /health` | `{status, ffmpeg}`. |

## Safety limits

- **Inputs:** fetched only over HTTPS from hosts in `MEDIA_WORKER_INPUT_HOSTS` (the R2 endpoint host). The fetch refuses redirects, credentials, non-443 ports and bodies above the size caps.
- **Tool isolation:** FFmpeg and ffprobe get argument arrays, never a shell. They run with `-protocol_whitelist file`, so they cannot open network URLs themselves.
- **Input caps:** at most 12 clips, each 0.5 to 20 s and 200 MB or less, with 90 s total. Logo images are at most 10 MB and 4096 px on a side.
- **Process limits on Linux:** a 15-minute wall-clock timeout per render, a CPU-time limit, a 500 MB output-file limit, lowered priority, and 2 encoder and 2 filter threads.
- **Memory:** real RAM is bounded by the container's memory limit; set it to 4 GB. The 16 GB address-space limit only stops a runaway process, because FFmpeg reserves far more virtual memory than it uses.
- **Concurrency:** one job at a time per container. Scale by adding containers, not threads.
- **Persistence and retention:**
  - Jobs persist under `MEDIA_WORKER_DATA`, and a restart resumes queued or interrupted jobs from scratch.
  - Inputs are deleted as soon as the deliverable exists.
  - Finished jobs and results are deleted after 24 hours. The app stores its own copy in R2.
- **Host egress:** restrict network egress to the R2 host at the platform level as well.

## Configuration

| Variable | Purpose |
| --- | --- |
| `MEDIA_WORKER_TOKEN` | Shared bearer token, at least 32 characters. The app reads it as `MEDIA_WORKER_TOKEN`, with `MEDIA_WORKER_URL`. |
| `MEDIA_WORKER_INPUT_HOSTS` | Comma-separated hosts clips and logos may come from, e.g. `<account>.r2.cloudflarestorage.com`. |
| `MEDIA_WORKER_DATA` | Job directory (default `/data`). Use a persistent volume if the platform offers one. |
| `MEDIA_WORKER_FONT` | CTA font (default DejaVu Sans Bold from the image). |
| `PORT` | Listen port (default 8080). TLS is terminated by the hosting platform; the app only downloads results over HTTPS. |

## Tests

```bash
python -m unittest discover -s services/media-worker/tests -v   # pnpm worker:test
```

- **Always run:** validation, the URL allowlist, FFmpeg argument construction, authentication, idempotency and reconciliation, restart recovery, retention, and safe error messages.
- **Render test:** encodes synthetic FFmpeg test patterns, a portrait and a landscape clip, plus a plain logo, then checks the deliverable. It is skipped when `ffmpeg`, `ffprobe` or a font is missing. CI installs Ubuntu's `ffmpeg` package and runs it on every push.

## Licensing

Debian and Ubuntu build `ffmpeg` with `--enable-gpl` and link libx264 (GPL-2.0-or-later). VIDZO runs it as a network service and does not distribute the binary, so GPL source-distribution duties are not triggered. Revisit this if the worker image is ever shipped to customers. The DejaVu fonts use a permissive licence. The `-version` line in each job report records the exact FFmpeg build used.

## Hosting

Heavy encoding does not belong in a Cloudflare Worker request. Any small Linux container host with HTTPS works: Cloudflare Containers, Fly.io, Railway or a VPS. Give it at least 2 vCPU, 4 GB RAM and a few GB of disk. The host is still to be chosen, together with a monthly cost cap.
