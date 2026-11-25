'use client';
import { useEffect, useRef, useState } from 'react';
import { FileJson, ImageOff } from 'lucide-react';
import type { Asset, JobView, Project, Quote, QuoteScope } from '@/lib/domain/schema';
import { useWorkspace } from '../workspace-provider';

export type StudioActions = {
  change: (p: Project) => void;
  flush: () => Promise<boolean>;
  requestQuote: (scope: QuoteScope, targetId?: string) => void;
  approve: (sceneId: string, frameAssetId: string) => Promise<void>;
  upload: (file: File, kind: 'reference' | 'product' | 'logo') => Promise<Asset | null>;
  analyze: () => Promise<void>;
  retry: (jobId: string) => void;
  busy: boolean;
  job?: JobView;
};
export type StepProps = { project: Project; actions: StudioActions };

const active = (s?: string) => s === 'queued' || s === 'submitted' || s === 'running';

/** Polls a job with backoff until it leaves the active states. Shows actual stages only. */
export function useJob(jobId: string | undefined, onSettled: (job: JobView) => void) {
  const { backend } = useWorkspace();
  const [job, setJob] = useState<JobView>();
  const settled = useRef(onSettled); settled.current = onSettled;
  useEffect(() => {
    if (!jobId) { setJob(undefined); return; }
    let live = true, delay = 1200, timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await backend.job(jobId);
        if (!live) return;
        setJob(j);
        if (!active(j.status)) { settled.current(j); return; }
        delay = Math.min(delay * 1.3, 10_000);
      } catch { delay = Math.min(delay * 2, 15_000); }
      if (live) timer = setTimeout(tick, delay);
    };
    void tick();
    return () => { live = false; clearTimeout(timer); };
  }, [jobId, backend]);
  return job;
}
export const jobActive = active;

/** Signed, short-lived preview of a private asset. Placeholders are always labelled. */
export function PrivateMedia({ asset, alt, className }: { asset?: Asset; alt: string; className?: string }) {
  const { backend } = useWorkspace();
  const [src, setSrc] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    let live = true; setSrc(''); setError('');
    if (asset && asset.status !== 'rejected') backend.assetUrl(asset.id).then(u => { if (live) setSrc(u); }).catch(e => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [asset?.id, asset?.status, backend]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!asset) return null;
  const label = asset.placeholder ? <span className="placeholder-tag">Test placeholder · not AI output</span> : null;
  if (error) return <div className={'media-frame ' + (className ?? '')}><ImageOff size={22}/><span className="small-text muted">{error}</span></div>;
  if (!src) return <div className={'media-frame loading ' + (className ?? '')} aria-busy="true"><span className="small-text muted">Loading preview…</span></div>;
  if (asset.mime.startsWith('video/')) return <div className={'media-frame ' + (className ?? '')}>{label}<video controls preload="metadata" src={src} aria-label={alt}><track kind="captions"/></video></div>;
  if (asset.mime === 'application/json') return <div className={'media-frame ' + (className ?? '')}>{label}<FileJson size={28}/><a className="text-button" href={src} target="_blank" rel="noreferrer">Open assembly manifest</a></div>;
  return <div className={'media-frame ' + (className ?? '')}>{label}{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt={alt}/></div>;
}

export function JobStatus({ job, onRetry }: { job?: JobView; onRetry?: (id: string) => void }) {
  if (!job) return null;
  const failed = job.tasks.filter(t => t.status === 'failed').length;
  return <div className={'job-panel ' + (job.status === 'failed' ? 'is-failed' : '')} role="status" aria-live="polite">
    <div><strong>{active(job.status) ? job.stage : job.status === 'failed' ? 'This job did not complete' : job.stage}</strong>
      <span className="small-text muted">{job.creditsReserved ? `${job.creditsReserved} credits ${active(job.status) ? 'held' : `· ${job.creditsSettled} settled, ${job.creditsReserved - job.creditsSettled} released`}` : 'No credits involved'}</span></div>
    <ol className="job-tasks">{job.tasks.map(t => <li key={t.taskId} className={'task-' + t.status}><span>{t.kind}</span><span>{t.status === 'unknown' ? 'checking with provider' : t.status}</span></li>)}</ol>
    {job.error && <p className="small-text">{job.error}</p>}
    {active(job.status) && <p className="small-text muted">You can leave this page; work continues and is saved.</p>}
    {!active(job.status) && failed > 0 && onRetry && job.kind !== 'analysis' && <button className="button secondary" onClick={() => onRetry(job.id)}>Quote a retry for the missing work</button>}
  </div>;
}

export const quoteLabel: Record<QuoteScope, string> = { frame: 'Storyboard frames', characters: 'Identity sheets', character: 'One identity redraw', video: 'Scene clips', scene: 'One scene revision', export: 'Final assembly' };
export const describeQuote = (q: Quote) => `${quoteLabel[q.scope]} · ${q.tasks.length} item${q.tasks.length === 1 ? '' : 's'}`;
