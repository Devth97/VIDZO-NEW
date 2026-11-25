import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "a18166538751152974d6594a321c30ef",
  worker: defineWorker({
    name: "vidzo-studio",
    entrypoint: "vinext/server/fetch-handler",
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
      HYPERDRIVE: bindings.hyperdrive({ id: "1cb835e255244016b66acd64f1da19ca", dev: { remote: true } }),
    },
  }),
});
