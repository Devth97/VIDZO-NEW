import { z } from 'zod';

/**
 * Pricing is configuration, never a constant baked into a quote path.
 * The values below are PRD hypotheses (base credit Rs 10, Rs 1,499 pilot for 10–15 s) used for the
 * demo and the local test backend only. Live mode refuses to quote until VIDZO_PRICING_JSON is set
 * from measured endpoint costs and margins.
 */
export const pricingSchema = z.object({
  version: z.string().min(1).max(40),
  illustrative: z.boolean(),
  creditValuePaise: z.number().int().positive(),
  perSecond: z.object({ professional: z.number().int().positive(), premium: z.number().int().positive() }),
  frame: z.number().int().nonnegative(),
  characterSheet: z.number().int().nonnegative(),
  export: z.number().int().nonnegative(),
  quoteTtlMinutes: z.number().int().min(1).max(120),
  models: z.object({ professional: z.string().max(120), premium: z.string().max(120), image: z.string().max(120) }),
  nativeResolution: z.object({ professional: z.string().max(80), premium: z.string().max(80) }),
  packs: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,30}$/), credits: z.number().int().positive(), paise: z.number().int().positive() })).min(1).max(6),
});
export type Pricing = z.infer<typeof pricingSchema>;

export const placeholderPricing: Pricing = {
  version: 'placeholder-2026-11',
  illustrative: true,
  creditValuePaise: 1000,
  perSecond: { professional: 10, premium: 15 },
  frame: 5,
  characterSheet: 15,
  export: 0,
  quoteTtlMinutes: 15,
  models: { professional: 'Professional benchmark candidate (not selected)', premium: 'Premium benchmark candidate (not selected)', image: 'Image endpoint (not selected)' },
  nativeResolution: { professional: 'Pending endpoint benchmark', premium: 'Pending endpoint benchmark' },
  packs: [{ id: 'starter', credits: 100, paise: 99_900 }, { id: 'studio', credits: 250, paise: 249_900 }],
};

export const retryPolicy = 'Transient provider errors retry automatically up to two times at no extra cost. Technical failures release unsettled credits. Creative redraws are separate quotes.';
