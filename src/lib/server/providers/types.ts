import type { Tier } from '@/lib/domain/schema';

/** Immutable snapshot of what a provider is asked to make. Stored on the job before any submission. */
export type ProviderTask = {
  taskId: string;
  kind: 'frame' | 'character' | 'clip' | 'export';
  tier: Tier;
  prompt: string;
  seconds?: number;
  sceneId?: string;
  candidateId?: string;
  label: string;
  /** Asset ids whose signed URLs are passed as image/video inputs. */
  inputAssetIds: string[];
  /** Export only: overlay instructions for deterministic assembly. */
  overlay?: { brand: string; cta: string; font: string; color: string; logoAssetId?: string };
};

export type ProviderInputs = { urls: Record<string, string> };
export type ProviderState = { state: 'queued' | 'running' | 'completed' | 'failed'; error?: string };
export type ProviderFile = { bytes: Uint8Array; mime: string; placeholder: boolean; name: string; meta?: Record<string, unknown> };

/**
 * transient – safe to retry (rate limit, 5xx before acceptance)
 * permanent – the request was rejected; retrying will not help
 * unknown   – the request may or may not have been accepted (timeout after sending). Never blindly replayed.
 */
export class ProviderError extends Error {
  constructor(public kind: 'transient' | 'permanent' | 'unknown', message: string) { super(message); this.name = 'ProviderError'; }
}

export interface ProviderAdapter {
  readonly name: string;
  endpoint(task: ProviderTask): string;
  submit(task: ProviderTask, inputs: ProviderInputs, idempotencyKey: string): Promise<{ requestId: string }>;
  status(requestId: string, task: ProviderTask): Promise<ProviderState>;
  result(requestId: string, task: ProviderTask): Promise<ProviderFile>;
  /** Finds a submission made with this idempotency key, if the provider supports lookup. */
  reconcile(idempotencyKey: string, task: ProviderTask): Promise<string | null>;
  cancel?(requestId: string, task: ProviderTask): Promise<void>;
}

/** Maps HTTP/network outcomes to retry semantics. `sent` is true once the request body may have reached the provider. */
export function normalizeError(e: unknown, sent: boolean): ProviderError {
  if (e instanceof ProviderError) return e;
  const status = typeof e === 'object' && e && 'status' in e ? Number((e as { status: unknown }).status) : NaN;
  if (status === 429 || (status >= 500 && status < 600)) return new ProviderError(sent && status >= 500 ? 'unknown' : 'transient', `Provider responded ${status}.`);
  if (status >= 400 && status < 500) return new ProviderError('permanent', `Provider rejected the request (${status}).`);
  return new ProviderError(sent ? 'unknown' : 'transient', 'The provider could not be reached.');
}
