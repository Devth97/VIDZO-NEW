import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

export default defineConfig({
  accountId: "a18166538751152974d6594a321c30ef",
  worker: defineWorker({
    name: "vidzo-studio",
    // vinext handles requests; src/worker.ts adds the scheduled job sweep.
    entrypoint: "./src/worker.ts",
    // Background job runner: one bounded sweep a minute (well inside the free plan's cron allowance).
    triggers: [triggers.scheduled({ schedule: "* * * * *" })],
    compatibilityDate: "2026-11-25",
    previewUrls: false,
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*", "!/assets/concepts/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      VIDZO_MODE: bindings.text("live"),
      APP_ORIGIN: bindings.text("https://vidzo.tech"),
      NEXT_PUBLIC_SUPABASE_URL: bindings.text("https://pehaquzsqeiocjirogei.supabase.co"),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.secret(),
      VIDZO_DATABASE_BINDING: bindings.text("hyperdrive"),
      // Private media bucket. The access key pair signs browser upload/download URLs (S3 API).
      R2_ACCOUNT_ID: bindings.text("a18166538751152974d6594a321c30ef"),
      R2_BUCKET: bindings.text("vidzo-media"),
      R2_ACCESS_KEY_ID: bindings.secret(),
      R2_SECRET_ACCESS_KEY: bindings.secret(),
      // FFmpeg media worker on Cloud Run (request-billed, so the synchronous render mode).
      MEDIA_WORKER_URL: bindings.text("https://vidzo-media-worker-344943560089.us-central1.run.app"),
      MEDIA_WORKER_MODE: bindings.text("sync"),
      MEDIA_WORKER_TOKEN: bindings.secret(),
      HYPERDRIVE: bindings.hyperdrive({ id: "1cb835e255244016b66acd64f1da19ca", dev: { remote: true } }),
    },
  }),
});
