"""Media worker tests. Run: python -m unittest discover -s services/media-worker/tests

The render test needs ffmpeg and ffprobe on PATH (or FFMPEG / FFPROBE). It renders synthetic test-pattern clips,
so no customer or third-party footage is involved; it is skipped when the binaries are missing.
"""
import functools
import http.server
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import worker as w  # noqa: E402

TOKEN = "t" * 40
FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
FFPROBE = os.environ.get("FFPROBE") or shutil.which("ffprobe")


def config(root: Path, **kw) -> w.Config:
    return w.Config(token=TOKEN, data=root, input_hosts=("files.example.test",), font=kw.pop("font", "/fonts/Bold.ttf"),
                    ffmpeg=FFMPEG or "ffmpeg", ffprobe=FFPROBE or "ffprobe", **kw)


def request(**kw):
    body = {"idempotencyKey": "job-123:export", "clips": ["https://files.example.test/a.mp4"], "target": dict(w.TARGET),
            "overlay": {"cta": "Shop now", "color": "#C8F169"}}
    body.update(kw)
    return body


class ValidationTests(unittest.TestCase):
    limits = w.Limits()

    def test_accepts_a_well_formed_request(self):
        r = w.validate_request(request(), self.limits)
        self.assertEqual(r["cta"], "Shop now")
        self.assertEqual(r["color"], "#c8f169")

    def test_rejects_other_targets_long_or_control_text_bad_colours_and_keys(self):
        for bad in (request(target={"width": 720, "height": 1280, "fps": 30}), request(overlay={"cta": "x" * 81}),
                    request(overlay={"cta": "a\nb"}), request(overlay={"color": "red"}), request(idempotencyKey="short"),
                    request(clips=[]), request(clips=["u"] * 13), request(logo=7)):
            with self.subTest(bad=bad), self.assertRaises(w.JobError):
                w.validate_request(bad, self.limits)

    def test_urls_must_be_https_on_an_allowlisted_host_without_credentials(self):
        cfg = config(Path("."))
        w.check_url("https://files.example.test/a.mp4?X-Amz-Signature=1", cfg)
        for bad in ("http://files.example.test/a.mp4", "https://evil.example.test/a.mp4", "https://u:p@files.example.test/a",
                    "https://files.example.test:8443/a", "file:///etc/passwd", "http://127.0.0.1:9/a", "https://169.254.169.254/latest"):
            with self.subTest(bad=bad), self.assertRaises(w.JobError):
                w.check_url(bad, cfg)
        w.check_url("http://127.0.0.1:9/a", config(Path("."), allow_loopback_http=True))  # local development only

    def test_clip_logo_and_output_checks(self):
        clip = {"format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2", "duration": "5.0"}, "streams": [{"codec_type": "video", "codec_name": "h264", "width": 720, "height": 1280}]}
        self.assertEqual(w.check_clip(clip, self.limits)["width"], 720)
        with self.assertRaises(w.JobError):
            w.check_clip({**clip, "format": {"format_name": "mov,mp4", "duration": "25"}}, self.limits)
        with self.assertRaises(w.JobError):
            w.check_clip({"format": {"format_name": "png_pipe", "duration": "1"}, "streams": clip["streams"]}, self.limits)
        with self.assertRaises(w.JobError):
            w.check_logo({"format": {}, "streams": [{"codec_type": "video", "codec_name": "h264", "width": 10, "height": 10}]}, self.limits)
        good = {"format": {"format_name": "mov,mp4", "duration": "12.02"}, "streams": [
            {"codec_type": "video", "codec_name": "h264", "width": 1080, "height": 1920, "avg_frame_rate": "30/1", "pix_fmt": "yuv420p"},
            {"codec_type": "audio", "codec_name": "aac", "sample_rate": "48000", "channels": 2}]}
        self.assertEqual(w.check_output(good, 12.0)["height"], 1920)
        bad = json.loads(json.dumps(good))
        bad["streams"][0].update(width=720, avg_frame_rate="25/1")
        with self.assertRaisesRegex(w.JobError, "1080x1920.*30 fps"):
            w.check_output(bad, 12.0)
        with self.assertRaisesRegex(w.JobError, "duration"):
            w.check_output(good, 15.0)


class ArgumentTests(unittest.TestCase):
    def test_one_deterministic_encode_with_local_inputs_only(self):
        cfg = config(Path("."), font="C:/Fonts/Bold.ttf")
        clips = [Path("/w/clip0.mp4"), Path("/w/clip1.mp4")]
        args = w.build_ffmpeg_args(cfg, clips, [4.0, 5.5], Path("/w/out.mp4"), Path("/w/logo.img"), Path("/w/cta.txt"), "#c8f169")
        self.assertIsInstance(args, list)
        self.assertEqual(args.count("-protocol_whitelist"), 3)  # every file input, including the logo
        self.assertEqual(args[args.index("-t") + 1], "9.5")
        graph = args[args.index("-filter_complex") + 1]
        self.assertIn("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30", graph)
        self.assertIn("concat=n=2:v=1:a=0", graph)  # clip audio is never mapped
        self.assertIn("textfile='/w/cta.txt':expansion=none", graph)
        self.assertIn("fontfile='C\\:/Fonts/Bold.ttf'", graph)
        self.assertIn("enable='gte(t\\,6.500)'", graph)
        self.assertNotIn("Shop", " ".join(args))  # CTA text only ever travels through the file
        self.assertEqual(args[args.index("-map") + 1], "[vout]")
        self.assertEqual(args[args.index("-map", args.index("-map") + 1) + 1], "3:a")  # generated silence
        for flag, value in (("-c:v", "libx264"), ("-c:a", "aac"), ("-r", "30"), ("-pix_fmt", "yuv420p")):
            self.assertEqual(args[args.index(flag) + 1], value)

    def test_without_logo_or_cta(self):
        args = w.build_ffmpeg_args(config(Path(".")), [Path("/w/clip0.mp4")], [3.0], Path("/w/out.mp4"), None, None, "#000000")
        graph = args[args.index("-filter_complex") + 1]
        self.assertNotIn("overlay", graph)
        self.assertNotIn("drawtext", graph)
        self.assertIn("1:a", args)

    def test_filter_escape(self):
        self.assertEqual(w.filter_escape("C:\\a'b,[c]"), "C\\:/a\\'b\\,\\[c\\]")


class StoreAndHttpTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.cfg = config(self.root)
        self.store = w.Store(self.root)
        self.submitted = []
        runner = w.Runner(self.cfg, self.store)
        runner.submit = self.submitted.append
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), w.make_handler(self.cfg, self.store, runner))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        shutil.rmtree(self.root, ignore_errors=True)

    def call(self, path, body=None, token=TOKEN):
        req = urllib.request.Request(self.base + path, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, method="POST" if body is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                return res.status, json.loads(res.read())
        except urllib.error.HTTPError as e:
            with e:
                return e.code, json.loads(e.read())

    def test_requires_the_token(self):
        self.assertEqual(self.call("/jobs/" + "0" * 32, token="wrong")[0], 401)
        self.assertEqual(self.call("/health")[0], 200)

    def test_submission_is_idempotent_and_reconcilable(self):
        status, first = self.call("/jobs", request())
        self.assertEqual((status, first["state"]), (202, "queued"))
        status, again = self.call("/jobs", request())
        self.assertEqual((status, again["id"]), (200, first["id"]))
        self.assertEqual(self.submitted, [first["id"]])  # queued once
        self.assertEqual(self.call("/jobs?idempotencyKey=job-123:export")[1]["id"], first["id"])
        self.assertEqual(self.call("/jobs?idempotencyKey=other-key-1")[0], 404)
        self.assertEqual(self.call(f"/jobs/{first['id']}/result")[0], 404)  # nothing until completed

    def test_rejects_disallowed_inputs_before_queueing(self):
        status, body = self.call("/jobs", request(clips=["https://elsewhere.example.test/a.mp4"]))
        self.assertEqual(status, 400)
        self.assertIn("host", body["error"])
        self.assertEqual(self.submitted, [])

    def test_restart_resumes_unfinished_jobs_and_purges_old_ones(self):
        queued, _ = self.store.create(w.validate_request(request(idempotencyKey="resume-me-1"), self.cfg.limits))
        running, _ = self.store.create(w.validate_request(request(idempotencyKey="resume-me-2"), self.cfg.limits))
        self.store.update(running["id"], state="running")
        done, _ = self.store.create(w.validate_request(request(idempotencyKey="old-done-1"), self.cfg.limits))
        self.store.update(done["id"], state="completed")
        fresh = w.Runner(self.cfg, self.store)
        fresh._loop = lambda: None
        fresh.start()
        self.assertEqual(sorted([fresh.queue.get_nowait(), fresh.queue.get_nowait()]), sorted([queued["id"], running["id"]]))
        self.store.purge(time.time() + 1)
        self.assertIsNone(self.store.by_key("old-done-1"))
        self.assertIsNotNone(self.store.by_key("resume-me-1"))

    def test_a_failure_reports_a_safe_message(self):
        job, _ = self.store.create(w.validate_request(request(), self.cfg.limits))
        result = w.Runner(self.cfg, self.store).process(job["id"])  # the host does not resolve
        self.assertEqual(result["state"], "failed")
        self.assertNotIn("example.test", result["error"])


def find_font() -> str | None:
    for p in (os.environ.get("MEDIA_WORKER_FONT"), "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"):
        if p and Path(p).is_file():
            return p
    return None


@unittest.skipUnless(FFMPEG and FFPROBE and find_font(), "ffmpeg, ffprobe and a font are needed for the render test")
class RenderTests(unittest.TestCase):
    def test_renders_a_valid_deliverable_from_synthetic_clips(self):
        root = Path(tempfile.mkdtemp())
        files = root / "files"
        files.mkdir()
        try:
            for i, (size, seconds) in enumerate((("720x1280", 2), ("1280x720", 3))):  # a portrait and a landscape source
                subprocess.run([FFMPEG, "-v", "error", "-f", "lavfi", "-i", f"testsrc2=size={size}:rate=24:duration={seconds}",
                                "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(files / f"c{i}.mp4")], check=True)
            subprocess.run([FFMPEG, "-v", "error", "-f", "lavfi", "-i", "color=c=white:size=400x200", "-frames:v", "1", str(files / "logo.png")], check=True)
            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(files)))
            threading.Thread(target=server.serve_forever, daemon=True).start()
            base = f"http://127.0.0.1:{server.server_address[1]}"
            cfg = config(root / "data", font=find_font(), allow_loopback_http=True)
            store = w.Store(cfg.data)
            job, _ = store.create(w.validate_request(request(clips=[f"{base}/c0.mp4", f"{base}/c1.mp4"], logo=f"{base}/logo.png"), cfg.limits))
            result = w.Runner(cfg, store).process(job["id"])
            server.shutdown()
            server.server_close()
            self.assertEqual(result["state"], "completed", result.get("error"))
            out = result["report"]["output"]
            self.assertEqual((out["width"], out["height"], out["fps"], out["videoCodec"], out["audioCodec"]), (1080, 1920, "30/1", "h264", "aac"))
            self.assertAlmostEqual(out["seconds"], 5.0, delta=w.DURATION_TOLERANCE)
            self.assertTrue(result["report"]["upscaled"])
            self.assertTrue((store.dir(job["id"]) / "result.mp4").is_file())
            self.assertFalse((store.dir(job["id"]) / "work").exists())  # inputs deleted after rendering
        finally:
            shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
