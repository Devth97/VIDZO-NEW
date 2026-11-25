import { z } from 'zod';

export const steps = ['Reference', 'Analysis', 'Characters', 'Brand & brief', 'Storyboard', 'Generate', 'Export'] as const;

/**
 * Assets are immutable records. Uploaded originals (reference/product/logo) and server outputs
 * (frame/character/clip/export) share one shape. `placeholder: true` marks illustrative or
 * local-test files that were NOT produced by an AI model; the UI must label them.
 * Storage object keys never leave the server, so they are not part of this schema.
 */
export const assetKinds = ['reference', 'product', 'logo', 'frame', 'character', 'clip', 'export'] as const;
export const uploadKinds = ['reference', 'product', 'logo'] as const;
export const videoMimes = ['video/mp4', 'video/quicktime'] as const;
export const imageMimes = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const assetSchema = z.object({
  id: z.uuid(),
  kind: z.enum(assetKinds),
  name: z.string().min(1).max(200),
  mime: z.enum([...videoMimes, ...imageMimes, 'image/svg+xml', 'application/json']),
  bytes: z.number().int().positive().max(100_000_000),
  status: z.enum(['pending', 'verified', 'rejected']),
  placeholder: z.boolean(),
  seconds: z.number().finite().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  codec: z.string().max(40).optional(),
  sceneId: z.string().max(80).optional(),
  candidateId: z.string().max(80).optional(),
  depHash: z.string().max(80).optional(),
  version: z.number().int().positive().optional(),
  rejectReason: z.string().max(300).optional(),
  createdAt: z.string(),
});
export type Asset = z.infer<typeof assetSchema>;
export type AssetKind = Asset['kind'];

export const roleSchema = z.object({ id: z.string().min(1).max(80), description: z.string().max(1000), confidence: z.number().min(0).max(1) });
export const shotSchema = z.object({
  id: z.string().min(1).max(80), startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(),
  camera: z.string().max(300), productAction: z.string().max(500), lighting: z.string().max(300), dialogue: z.string().max(1000),
  roleIds: z.array(z.string().max(80)).max(2),
});
export const analysisSchema = z.object({
  summary: z.string().max(5000), hook: z.string().max(2000), cta: z.string().max(500),
  roles: z.array(roleSchema).max(2), risks: z.array(z.string().max(1000)).max(20),
  shots: z.array(shotSchema).min(1).max(30),
  /** Where the analysis came from. 'sample' and 'local-test' are not derived from the uploaded video. */
  source: z.enum(['sample', 'local-test', 'model']).default('sample'),
  /** Source video duration the timestamps must stay within. */
  durationMs: z.number().int().positive().optional(),
});
export type Analysis = z.infer<typeof analysisSchema>;
export type Role = z.infer<typeof roleSchema>;

/** User-editable candidate spec. Identity sheets are `character` assets keyed by candidateId + version. */
export const candidateSchema = z.object({ id: z.string().min(1).max(80), roleId: z.string().max(80), name: z.string().max(80), description: z.string().max(1000), roleDescription: z.string().max(1000) });
export type Candidate = z.infer<typeof candidateSchema>;

export const approvalSchema = z.object({ frameAssetId: z.uuid(), depHash: z.string().max(80), at: z.string() });
export const sceneSchema = z.object({
  id: z.string().min(1).max(80), title: z.string().max(120), seconds: z.number().int().min(2).max(8),
  prompt: z.string().min(1).max(4000), roleIds: z.array(z.string().max(80)).max(2), locked: z.boolean(),
  version: z.number().int().positive(),
  history: z.array(z.object({ version: z.number().int(), prompt: z.string(), seconds: z.number().int(), at: z.string() })).max(200),
  /** Server-owned. Valid only while depHash equals the scene's current dependency hash. */
  approval: approvalSchema.nullable(),
});
export type Scene = z.infer<typeof sceneSchema>;

export const briefSchema = z.object({
  brand: z.string().max(100), product: z.string().max(200), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), font: z.string().max(100),
  objective: z.string().max(500), audience: z.string().max(1000), language: z.string().max(80), tone: z.string().max(200),
  cta: z.string().max(200), offer: z.string().max(500), claims: z.string().max(2000), differences: z.string().max(2000),
});
export type Brief = z.infer<typeof briefSchema>;

export const qaSchema = z.object({ exportAssetId: z.uuid(), decision: z.enum(['pending', 'approved', 'rejected']), note: z.string().max(2000).optional(), at: z.string() });
export const projectStatuses = ['draft', 'analyzing', 'generating', 'review', 'ready', 'failed'] as const;
export const projectSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(100), updatedAt: z.string(), step: z.number().int().min(0).max(6),
  revision: z.number().int().nonnegative(), rights: z.boolean(), sample: z.boolean(),
  analysis: analysisSchema.nullable(), candidates: z.array(candidateSchema).max(12),
  /** roleId → candidateId chosen by the user. */
  selections: z.record(z.string(), z.string()),
  brief: briefSchema, scenes: z.array(sceneSchema).min(1).max(4),
  // ---- server-owned facts (ignored when a client saves) ----
  assets: z.array(assetSchema).max(400),
  status: z.enum(projectStatuses),
  activeJobId: z.uuid().optional(), lastError: z.string().max(500).optional(),
  qa: qaSchema.nullable(),
});
export type Project = z.infer<typeof projectSchema>;
export type ProjectStatus = Project['status'];

export type Tier = 'professional' | 'premium';
export const quoteScopes = ['frame', 'characters', 'character', 'video', 'scene', 'export'] as const;
export type QuoteScope = typeof quoteScopes[number];
export type QuoteTask = { taskId: string; kind: 'frame' | 'character' | 'clip' | 'export'; sceneId?: string; candidateId?: string; depHash: string; credits: number; seconds?: number };
export type Quote = {
  id: string; projectId: string; fingerprint: string; tier: Tier; scope: QuoteScope; targetId?: string;
  credits: number; seconds: number; expiresAt: number; nativeResolution: string; model: string;
  pricingVersion: string; retryPolicy: string; tasks: QuoteTask[]; illustrative: boolean;
};

export type LedgerKind = 'reserve' | 'settle' | 'release' | 'purchase' | 'adjust';
export type Operation = { id: string; amount: number; kind: LedgerKind; at: string; note?: string };
export type Wallet = { available: number; held: number; spent: number; operations: Operation[] };

export type JobStatus = 'queued' | 'submitted' | 'running' | 'review' | 'succeeded' | 'failed' | 'canceled';
export type JobView = { id: string; projectId: string; kind: string; status: JobStatus; stage: string; error?: string; creditsReserved: number; creditsSettled: number; createdAt: string; updatedAt: string; tasks: { taskId: string; kind: string; sceneId?: string; status: string; error?: string }[] };

export const rupees = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
