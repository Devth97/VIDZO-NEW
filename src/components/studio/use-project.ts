'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '@/lib/domain/schema';
import { ApiError } from '../backend';
import { useWorkspace } from '../workspace-provider';

export type SaveState = 'saved' | 'pending' | 'saving' | 'offline' | 'error' | 'conflict';

/** Server-owned fields: always taken from the server copy, even while local edits are pending. */
function withServerFacts(local: Project, server: Project): Project {
  return {
    ...local, revision: server.revision, updatedAt: server.updatedAt, assets: server.assets, status: server.status, activeJobId: server.activeJobId,
    lastError: server.lastError, qa: server.qa, analysis: local.analysis && server.analysis ? { ...local.analysis, source: server.analysis.source, durationMs: server.analysis.durationMs } : server.analysis,
    scenes: local.scenes.map(s => { const srv = server.scenes.find(x => x.id === s.id); return srv ? { ...s, approval: srv.approval, version: Math.max(s.version, srv.version), history: srv.history } : s; }),
  };
}

/**
 * Edits apply locally at once; saves are debounced, strictly serialized and versioned:
 * - every edit increments `seq`; a save records the seq it sent, so an older completion never marks newer edits clean
 * - only one request is in flight; edits made meanwhile are sent after it completes, with the new revision
 * - `flush()` resolves once everything up to now is saved (used before navigation, approvals and spend)
 * - a stale revision (409) stops autosave and asks the user to reload instead of overwriting other work
 */
export function useProjectEditor(id: string) {
  const { backend, projects, ready, upsert } = useWorkspace();
  const [project, setProject] = useState<Project | null>(null);
  const [state, setState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState('');
  const latest = useRef<Project | null>(null);
  const revision = useRef(0), seq = useRef(0), savedSeq = useRef(0), inflight = useRef<Promise<void> | null>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), blocked = useRef(false);

  const apply = useCallback((p: Project) => { latest.current = p; setProject(p); }, []);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  // Initial load from the workspace snapshot, then a fresh server copy.
  useEffect(() => {
    if (!ready || latest.current?.id === id) return;
    const known = projects.find(p => p.id === id);
    if (known) { revision.current = known.revision; apply(known); }
    backend.getProject(id).then(p => { if (seq.current === savedSeq.current) { revision.current = p.revision; apply(p); upsert(p); } }).catch(() => { if (!known) setProject(null); });
  }, [ready, id, projects, backend, apply, upsert]);

  const saveLoop = useCallback(async () => {
    while (!blocked.current && latest.current && seq.current > savedSeq.current) {
      const sentSeq = seq.current, snapshot = latest.current;
      setState('saving');
      try {
        const server = await backend.saveProject(snapshot, revision.current);
        revision.current = server.revision;
        savedSeq.current = Math.max(savedSeq.current, sentSeq);
        const next = seq.current === sentSeq ? server : withServerFacts(latest.current!, server);
        apply(next); upsert(server); setSaveError('');
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 409 && err.code === 'conflict') { blocked.current = true; setState('conflict'); setSaveError(err.message); return; }
        if (err.status === 0) { setState('offline'); setSaveError(err.message); timer.current = setTimeout(() => void flushRef.current(), 5000); return; }
        if (err.status === 422 || err.status === 400) {
          // The server refused this edit (e.g. a rule violation). Restore the server's copy so the UI never shows unsaved fiction.
          setSaveError(err.message); setState('error');
          try { const server = await backend.getProject(snapshot.id); revision.current = server.revision; savedSeq.current = seq.current; apply(server); upsert(server); } catch { /* keep local */ }
          return;
        }
        setState('error'); setSaveError(err.message); return;
      }
    }
    if (!blocked.current) setState(seq.current > savedSeq.current ? 'pending' : 'saved');
  }, [backend, apply, upsert]);

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    if (inflight.current) await inflight.current;
    if (seq.current > savedSeq.current && !blocked.current) { inflight.current = saveLoop().finally(() => { inflight.current = null; }); await inflight.current; }
    return seq.current === savedSeq.current && !blocked.current;
  }, [saveLoop]);

  flushRef.current = flush;

  const change = useCallback((p: Project) => {
    if (blocked.current) return;
    seq.current++; apply(p); setState('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  }, [apply, flush]);

  /** Replace with an authoritative server copy (after approvals, jobs, uploads) without losing pending edits. */
  const adopt = useCallback((server: Project) => {
    revision.current = Math.max(revision.current, server.revision);
    const next = seq.current > savedSeq.current && latest.current ? withServerFacts(latest.current, server) : server;
    apply(next); upsert(server);
  }, [apply, upsert]);

  const reload = useCallback(async () => {
    const server = await backend.getProject(id);
    blocked.current = false; seq.current = savedSeq.current; revision.current = server.revision; setSaveError(''); setState('saved'); apply(server); upsert(server);
  }, [backend, id, apply, upsert]);

  // Warn before leaving with unsaved edits; flush on unmount.
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (seq.current > savedSeq.current) { void flush(); e.preventDefault(); } };
    window.addEventListener('beforeunload', before);
    return () => { window.removeEventListener('beforeunload', before); void flush(); };
  }, [flush]);

  return { project, change, flush, adopt, reload, saveState: state, saveError, dirty: () => seq.current > savedSeq.current };
}
