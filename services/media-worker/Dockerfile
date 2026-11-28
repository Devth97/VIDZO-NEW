# VIDZO media worker. Debian's ffmpeg package (GPL build with libx264 and the native AAC encoder) and the
# DejaVu font used for the CTA. Pin the base image by digest when choosing the production host.
FROM python:3.12-slim-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin worker \
 && mkdir -p /data && chown worker /data

COPY worker.py /app/worker.py

USER worker
ENV MEDIA_WORKER_DATA=/data PORT=8080 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=4)"]
CMD ["python", "-I", "/app/worker.py"]
