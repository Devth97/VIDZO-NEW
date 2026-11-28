# VIDZO media worker: Python service + Debian's ffmpeg (GPL build with libx264, libvpx and the native AAC
# encoder) + HyperFrames (Apache-2.0) with headless Chrome for the motion-graphics layer.
# Pin the base image by digest when the production host is final.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ffmpeg fonts-dejavu-core ca-certificates \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
      libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 libx11-xcb1 libxshmfence1 libdbus-1-3 \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g --no-fund --no-audit hyperframes@0.9.43 gsap@3.15.1 \
 && mkdir -p /opt/vidzo && cp "$(npm root -g)/gsap/dist/gsap.min.js" /opt/vidzo/gsap.min.js \
 && useradd --system --uid 10001 --create-home --home-dir /home/worker --shell /usr/sbin/nologin worker \
 && mkdir -p /data && chown worker /data

COPY worker.py effects.py /app/

USER worker
ENV HOME=/home/worker MEDIA_WORKER_DATA=/data PORT=8080 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 MEDIA_WORKER_GSAP=/opt/vidzo/gsap.min.js
# Bundled headless Chrome for HyperFrames, cached in the image so renders never download it.
RUN hyperframes browser ensure
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD ["python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=4)"]
CMD ["python3", "-I", "/app/worker.py"]
