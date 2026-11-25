'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { projectSchema, type Project, type Wallet, type Asset } from '@/lib/domain/schema';
import { newProject } from '@/lib/domain/project';
import { sampleProject } from '@/lib/domain/sample';

type Workspace = { projects: Project[]; wallet: Wallet; role: string; workspaceId?: string };
type Context = Workspace & { ready: boolean; demo: boolean; error: string; save: (p: Project) => Promise<void>; create: (name: string, sample?: boolean) => Promise<string>; refresh: () => Promise<void>; changeWallet: (w: Wallet) => void; upload: (p: Project, file: File, kind: Asset['kind'], seconds?: number) => Promise<Asset>; preview: (asset: Asset) => Promise<string>; notify: (message: string) => void };
const Context = createContext<Context | null>(null);
const empty: Workspace = { projects: [], wallet: { available: 300, held: 0, spent: 0, operations: [] }, role: 'demo' };
const storageKey = 'vidzo-demo-v1';
async function db() { return new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('vidzo-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('assets'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
export async function api<T>(url: string, data?: unknown, method?: string): Promise<T> {
  const response = await fetch(url, { method: method ?? (data ? 'POST' : 'GET'), headers: data ? { 'Content-Type': 'application/json' } : undefined, body: data ? JSON.stringify(data) : undefined });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'The request could not be completed.');
  return json as T;
}
export function WorkspaceProvider({ children, demo }: { children: ReactNode; demo: boolean }) {
  const [state, setState] = useState<Workspace>(empty), [ready, setReady] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const stateRef = useRef(state); stateRef.current = state;
  const urls = useRef(new Map<string, string>());
  const refresh = useCallback(async () => {
    if (demo) return;
    const data = await api<Workspace>('/api/workspace'); setState(data);
  }, [demo]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (demo) {
          const value = localStorage.getItem(storageKey);
          if (value) {
            const parsed = JSON.parse(value) as Workspace;
            parsed.projects = parsed.projects.map(p => projectSchema.parse(p));
            if (active) setState(parsed);
          }
        } else await refresh();
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Drafts could not be loaded.'); }
      finally { if (active) setReady(true); }
    }
    void load(); return () => { active = false; };
  }, [demo, refresh]);
  useEffect(() => { if (ready && demo) { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { setError('Browser storage is full. Export your brief before closing.'); } } }, [state, ready, demo]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  async function save(project: Project) {
    const p = projectSchema.parse({ ...project, updatedAt: new Date().toISOString() });
    if (!demo) await api('/api/projects/' + p.id, { project: p }, 'PUT');
    setState(s => ({ ...s, projects: s.projects.some(a => a.id === p.id) ? s.projects.map(a => a.id === p.id ? p : a) : [p, ...s.projects] }));
  }
  async function create(name: string, sample = false) {
    const p = sample ? sampleProject() : newProject(name);
    if (!demo && sample) throw new Error('Sample projects are available in demo mode only.');
    if (!demo) await api('/api/projects', { project: p });
    setState(s => ({ ...s, projects: [p, ...s.projects] })); return p.id;
  }
  async function upload(p: Project, file: File, kind: Asset['kind'], seconds?: number): Promise<Asset> {
    const asset: Asset = { id: crypto.randomUUID(), name: file.name, kind, mime: file.type as Asset['mime'], bytes: file.size, seconds, verified: false };
    if (demo) {
      const store = await db();
      await new Promise<void>((resolve, reject) => { const tx = store.transaction('assets', 'readwrite'); tx.objectStore('assets').put(file, asset.id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
      store.close();
    } else {
      const result = await api<{ asset: Asset; url: string }>('/api/assets/sign', { projectId: p.id, asset });
      const response = await fetch(result.url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('Upload failed. Please try again.');
      return result.asset;
    }
    return asset;
  }
  async function preview(asset: Asset) {
    if (!demo) return (await api<{ url: string }>('/api/assets/' + asset.id)).url;
    const cached = urls.current.get(asset.id); if (cached) return cached;
    const store = await db();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => { const r = store.transaction('assets').objectStore('assets').get(asset.id); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); store.close();
    if (!blob) throw new Error('This file is no longer in browser storage. Upload it again.');
    const url = URL.createObjectURL(blob); urls.current.set(asset.id, url); return url;
  }
  return <Context.Provider value={{ ...state, ready, demo, error, save, create, refresh, upload, preview, changeWallet: wallet => setState(s => ({ ...s, wallet })), notify: setNotice }}>
    {children}<div className={'toast' + (notice ? ' visible' : '')} role="status">{notice}</div>
  </Context.Provider>;
}
export function useWorkspace() { const ctx = useContext(Context); if (!ctx) throw new Error('Workspace provider missing'); return ctx; }
