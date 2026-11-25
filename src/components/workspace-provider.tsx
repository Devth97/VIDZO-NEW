'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { placeholderPricing, type Pricing } from '@/lib/domain/pricing';
import type { Project, Wallet } from '@/lib/domain/schema';
import { ApiError, createDemoBackend, serverBackend, type Backend, type Capabilities, type Mode, type Snapshot } from './backend';

type Ctx = Snapshot & {
  mode: Mode; demo: boolean; backend: Backend; ready: boolean; signedOut: boolean; error: string;
  pricing: Pricing | null; capabilities: Capabilities | null;
  refresh: () => Promise<void>; upsert: (p: Project) => void; remove: (id: string) => void; setWallet: (w: Wallet) => void; notify: (message: string) => void;
};
const Context = createContext<Ctx | null>(null);
const emptyWallet: Wallet = { available: 0, held: 0, spent: 0, operations: [] };

export function WorkspaceProvider({ children, mode }: { children: ReactNode; mode: Mode }) {
  const backend = useMemo<Backend>(() => (mode === 'demo' ? createDemoBackend() : serverBackend), [mode]);
  const [snap, setSnap] = useState<Snapshot>({ projects: [], wallet: emptyWallet, role: mode === 'demo' ? 'demo' : 'member' });
  const [ready, setReady] = useState(false), [signedOut, setSignedOut] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [pricing, setPricing] = useState<Pricing | null>(mode === 'demo' ? placeholderPricing : null), [capabilities, setCapabilities] = useState<Capabilities | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await backend.load();
      setSnap(s); setSignedOut(false); setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setSignedOut(true);
      else setError(e instanceof Error ? e.message : 'Your workspace could not be loaded.');
    } finally { setReady(true); }
  }, [backend]);

  useEffect(() => {
    void refresh();
    if (mode !== 'demo') fetch('/api/session', { cache: 'no-store' }).then(r => r.json()).then(s => { setPricing(s.pricing ?? null); setCapabilities(s.capabilities ?? null); }).catch(() => undefined);
  }, [refresh, mode]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(t); }, [notice]);

  const upsert = useCallback((p: Project) => setSnap(s => ({ ...s, projects: s.projects.some(x => x.id === p.id) ? s.projects.map(x => (x.id === p.id ? p : x)) : [p, ...s.projects] })), []);
  const remove = useCallback((id: string) => setSnap(s => ({ ...s, projects: s.projects.filter(p => p.id !== id) })), []);
  const setWallet = useCallback((wallet: Wallet) => setSnap(s => ({ ...s, wallet })), []);

  const value: Ctx = { ...snap, mode, demo: mode === 'demo', backend, ready, signedOut, error, pricing, capabilities, refresh, upsert, remove, setWallet, notify: setNotice };
  return <Context.Provider value={value}>{children}<div className={'toast' + (notice ? ' visible' : '')} role="status" aria-live="polite">{notice}</div></Context.Provider>;
}

export function useWorkspace() { const ctx = useContext(Context); if (!ctx) throw new Error('Workspace provider missing'); return ctx; }
