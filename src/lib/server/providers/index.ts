import 'server-only';
import { live, mode } from '../config';
import { HttpError } from '../errors';
import { geminiAnalyzer, localAnalyzer, type Analyzer } from './analysis';
import { falProvider } from './fal';
import { simulatedProvider } from './simulated';
import type { ProviderAdapter, ProviderTask } from './types';
import { workerProvider } from './worker';

const g = globalThis as unknown as { __vidzoProviders?: { generation?: ProviderAdapter; assembly?: ProviderAdapter; analyzer?: Analyzer } };
const overrides = () => (g.__vidzoProviders ??= {});

/** Tests replace adapters here. */
export function setTestProviders(p: { generation?: ProviderAdapter; assembly?: ProviderAdapter; analyzer?: Analyzer } | undefined) { g.__vidzoProviders = p ?? {}; }

let sim: ProviderAdapter | undefined;
export function providerFor(kind: ProviderTask['kind']): ProviderAdapter {
  const o = overrides();
  if (kind === 'export' && o.assembly) return o.assembly;
  if (kind !== 'export' && o.generation) return o.generation;
  if (mode() === 'local') return (sim ??= simulatedProvider());
  if (mode() === 'live') {
    if (kind === 'export') { const w = live.worker(); if (!w) throw new HttpError(503, 'Final assembly is not configured yet.', 'not_configured'); return workerProvider(w); }
    const f = live.fal(); if (!f) throw new HttpError(503, 'Generation is not configured yet.', 'not_configured'); return falProvider(f);
  }
  throw new HttpError(404, 'Generation is not available in demo mode.', 'demo_mode');
}

export function analyzer(): Analyzer {
  const o = overrides();
  if (o.analyzer) return o.analyzer;
  if (mode() === 'local') return localAnalyzer;
  if (mode() === 'live') { const cfg = live.gemini(); if (!cfg) throw new HttpError(503, 'Reference analysis is not configured yet.', 'not_configured'); return geminiAnalyzer(cfg); }
  throw new HttpError(404, 'Analysis is not available in demo mode.', 'demo_mode');
}
