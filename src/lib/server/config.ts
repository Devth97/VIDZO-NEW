import 'server-only';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { placeholderPricing, pricingSchema, type Pricing } from '@/lib/domain/pricing';

/**
 * demo  – browser-only exploration; no server data APIs.
 * local – full server stack on this machine: embedded Postgres (PGlite), disk storage with signed URLs,
 *         console sign-in links and SIMULATED providers that return labelled placeholder files.
 *         Refuses requests from non-loopback hosts.
 * live  – Supabase Auth/Postgres, Cloudflare R2, Gemini, fal and Razorpay. Each capability stays disabled
 *         (HTTP 503) until its configuration is present. Live never falls back to demo or simulated providers.
 */
export type Mode = 'demo' | 'local' | 'live';
export function mode(): Mode {
  const m = process.env.VIDZO_MODE;
  return m === 'live' || m === 'local' ? m : 'demo';
}

const env = (name: string) => { const v = process.env[name]; return v && v.trim() ? v.trim() : undefined; };

export const dataDir = () => path.join(process.cwd(), '.data');

/** Local-mode signing secret, generated once per checkout and kept out of Git (.data/ is ignored). */
let cachedLocalSecret: Buffer | undefined;
export function localSecret(): Buffer {
  if (mode() !== 'local') throw new Error('Local secret requested outside local mode.');
  if (cachedLocalSecret) return cachedLocalSecret;
  const file = path.join(dataDir(), 'local-secret');
  mkdirSync(dataDir(), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 });
  cachedLocalSecret = Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
  return cachedLocalSecret;
}

export const live = {
  databaseUrl: () => env('DATABASE_URL'),
  supabaseUrl: () => env('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseKey: () => env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ?? env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  r2: () => {
    const accountId = env('R2_ACCOUNT_ID'), accessKeyId = env('R2_ACCESS_KEY_ID'), secretAccessKey = env('R2_SECRET_ACCESS_KEY'), bucket = env('R2_BUCKET');
    return accountId && accessKeyId && secretAccessKey && bucket ? { accountId, accessKeyId, secretAccessKey, bucket } : undefined;
  },
  gemini: () => { const apiKey = env('GEMINI_API_KEY'), model = env('GEMINI_MODEL'); return apiKey && model ? { apiKey, model } : undefined; },
  fal: () => {
    const key = env('FAL_KEY'), image = env('FAL_IMAGE_ENDPOINT'), professional = env('FAL_VIDEO_ENDPOINT_PROFESSIONAL'), premium = env('FAL_VIDEO_ENDPOINT_PREMIUM');
    const resultHosts = (env('FAL_RESULT_HOSTS') ?? 'fal.media,v3.fal.media,storage.googleapis.com').split(',').map(h => h.trim()).filter(Boolean);
    return key && image && professional && premium ? { key, image, professional, premium, resultHosts } : undefined;
  },
  razorpay: () => {
    const keyId = env('RAZORPAY_KEY_ID'), keySecret = env('RAZORPAY_KEY_SECRET'), webhookSecret = env('RAZORPAY_WEBHOOK_SECRET');
    return keyId && keySecret && webhookSecret ? { keyId, keySecret, webhookSecret } : undefined;
  },
  worker: () => { const url = env('MEDIA_WORKER_URL'), token = env('MEDIA_WORKER_TOKEN'); return url && token ? { url, token } : undefined; },
  appOrigin: () => env('APP_ORIGIN'),
};

export const adminEmails = () => (env('VIDZO_ADMIN_EMAILS') ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export type Capabilities = { database: boolean; auth: boolean; storage: boolean; analysis: boolean; generation: boolean; payments: boolean; assembly: boolean; pricing: boolean };
export function capabilities(): Capabilities {
  const m = mode();
  if (m === 'demo') return { database: false, auth: false, storage: false, analysis: false, generation: false, payments: false, assembly: false, pricing: false };
  if (m === 'local') return { database: true, auth: true, storage: true, analysis: true, generation: true, payments: true, assembly: true, pricing: true };
  return {
    database: Boolean(live.databaseUrl()), auth: Boolean(live.supabaseUrl() && live.supabaseKey()), storage: Boolean(live.r2()),
    analysis: Boolean(live.gemini()), generation: Boolean(live.fal()), payments: Boolean(live.razorpay()), assembly: Boolean(live.worker()),
    pricing: Boolean(livePricing()),
  };
}

function livePricing(): Pricing | null {
  const raw = env('VIDZO_PRICING_JSON');
  if (!raw) return null;
  const parsed = pricingSchema.safeParse(JSON.parse(raw));
  if (!parsed.success || parsed.data.illustrative) return null;
  return parsed.data;
}

/** Local mode uses PRD placeholder pricing (clearly flagged). Live refuses to quote without measured pricing. */
export function pricing(): Pricing | null {
  const m = mode();
  if (m === 'local') return placeholderPricing;
  if (m === 'live') return livePricing();
  return null;
}
