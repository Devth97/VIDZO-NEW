import { z } from 'zod';

export const steps = ['Reference', 'Analysis', 'Characters', 'Brand & brief', 'Storyboard', 'Generate', 'Export'] as const;
export const assetSchema = z.object({
  id: z.uuid(), name: z.string().min(1).max(200), kind: z.enum(['reference', 'product', 'logo']),
  mime: z.enum(['video/mp4', 'video/quicktime', 'image/png', 'image/jpeg', 'image/webp']),
  bytes: z.number().int().positive().max(100_000_000), seconds: z.number().finite().optional(),
  key: z.string().max(500).optional(), preview: z.string().max(1000).optional(), verified: z.boolean().default(false),
});
export type Asset = z.infer<typeof assetSchema>;
export const roleSchema = z.object({ id: z.string().max(80), description: z.string().max(1000), confidence: z.number().min(0).max(1) });
export const analysisSchema = z.object({
  summary: z.string().max(5000), hook: z.string().max(2000), cta: z.string().max(500),
  roles: z.array(roleSchema).max(2), risks: z.array(z.string().max(1000)).max(20),
  shots: z.array(z.object({ id: z.string(), startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(), camera: z.string(), productAction: z.string(), lighting: z.string(), dialogue: z.string(), roleIds: z.array(z.string()).max(2) })).min(1).max(30),
});
export type Analysis = z.infer<typeof analysisSchema>;
const candidateSchema = z.object({ id: z.string(), roleId: z.string(), name: z.string(), description: z.string(), version: z.number().int().positive(), imageKey: z.string().optional(), approved: z.boolean(), history: z.array(z.object({ version: z.number(), imageKey: z.string().optional() })) });
export type Candidate = z.infer<typeof candidateSchema>;
export const sceneSchema = z.object({
  id: z.uuid(), title: z.string().max(120), seconds: z.number().int().min(2).max(8),
  prompt: z.string().min(1).max(4000), version: z.number().int().positive(), approved: z.boolean(), locked: z.boolean(),
  frameKey: z.string().optional(), frameApproved: z.boolean().default(false), clipUrl: z.string().optional(),
  history: z.array(z.object({ version: z.number().int(), prompt: z.string(), frameKey: z.string().optional(), clipUrl: z.string().optional() })),
});
export type Scene = z.infer<typeof sceneSchema>;
export const briefSchema = z.object({
  brand: z.string().max(100), product: z.string().max(200), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), font: z.string().max(100),
  objective: z.string().max(500), audience: z.string().max(1000), language: z.string().max(80), tone: z.string().max(200),
  cta: z.string().max(200), offer: z.string().max(500), claims: z.string().max(2000), differences: z.string().max(2000),
});
export const projectSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(100), updatedAt: z.string(), step: z.number().int().min(0).max(6), revision: z.number().int().nonnegative(),
  rights: z.boolean(), sample: z.boolean(), assets: z.array(assetSchema).max(30), analysis: analysisSchema.nullable(),
  characters: z.array(candidateSchema).max(40), brief: briefSchema, scenes: z.array(sceneSchema).min(1).max(4),
  status: z.enum(['draft', 'queued', 'running', 'review', 'ready', 'failed']),
  exportUrl: z.string().optional(), jobId: z.uuid().optional(), lastError: z.string().optional(),
});
export type Project = z.infer<typeof projectSchema>;
export type Tier = 'professional' | 'premium';
export type Quote = { id: string; projectId: string; fingerprint: string; tier: Tier; credits: number; seconds: number; expiresAt: number; nativeResolution: string; model: string; scope: string; };
export type Operation = { id: string; amount: number; kind: 'reserve' | 'settle' | 'release' | 'purchase'; at: string };
export type Wallet = { available: number; held: number; spent: number; operations: Operation[] };
export const packs = [{ id: 'starter', credits: 100, paise: 99900 }, { id: 'studio', credits: 250, paise: 249900 }] as const;
export const rupees = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
