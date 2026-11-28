'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileJson, ImageOff, Loader } from 'lucide-react';
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

const taskStatusText: Record<string, string> = { queued: 'Waiting', submitted: 'Submitted', running: 'In production', succeeded: 'Delivered', failed: 'Failed · credits released', unknown: 'Checking with provider', canceled: 'Canceled' };

/** Actual persisted job stages, with what the state means for credits and what the user can do next. */
export function JobStatus({ job, project, onRetry }: { job?: JobView; project?: Project; onRetry?: (id: string) => void }) {
  if (!job) return null;
  const failed = job.tasks.filter(t => t.status === 'failed').length;
  const unknown = job.tasks.some(t => t.status === 'unknown');
  const isActive = active(job.status);
  const released = job.creditsReserved - job.creditsSettled;
  const name = (t: JobView['tasks'][number]) => {
    const i = project?.scenes.findIndex(s => s.id === t.sceneId) ?? -1;
    return i >= 0 ? `Scene ${i + 1} · ${project!.scenes[i].title || t.kind}` : t.kind;
  };
  const Icon = job.status === 'failed' ? AlertTriangle : isActive ? Loader : CheckCircle2;
  return <div className={'job-panel ' + (job.status === 'failed' ? 'is-failed' : job.status === 'review' ? 'is-review' : '')} role="status" aria-live="polite">
    <div><strong><Icon size={16} aria-hidden="true" className={isActive ? 'spin-slow' : undefined}/>{job.status === 'failed' ? 'This job did not complete' : job.stage}</strong>
      <span className="small-text muted">{job.creditsReserved ? (isActive ? `${job.creditsReserved} credits held` : `${job.creditsSettled} settled · ${released} released`) : 'No credits involved'}</span></div>
    <ol className="job-tasks">{job.tasks.map(t => <li key={t.taskId} className={'task-' + t.status}><span>{name(t)}</span><span>{taskStatusText[t.status] ?? t.status}</span></li>)}</ol>
    {job.error && <p className="small-text">{job.error}</p>}
    {isActive && <p className="small-text muted">{job.status === 'queued' ? 'Waiting for a production slot. ' : ''}You can leave this page: progress is saved and the held credits are settled only for delivered items.</p>}
    {unknown && <p className="small-text muted">The provider has not confirmed one item yet. It will be checked, never sent twice, and its credits stay held until it is resolved.</p>}
    {job.status === 'review' && <p className="small-text muted">{job.kind === 'export' ? 'A VIDZO reviewer checks product, likeness, claims and CTA before download.' : 'Review the new work below. Approve it, or report a quality concern before paying for a redraw.'}</p>}
    {!isActive && failed > 0 && <>
      <p className="small-text">Technical failure, not a creative redraw: the {failed} undelivered item{failed === 1 ? '' : 's'} cost nothing{released ? ` and ${released} credits were released` : ''}.</p>
      <div className="inline-actions">
        {onRetry && job.kind !== 'analysis' && <button className="button secondary" onClick={() => onRetry(job.id)}>Quote a retry for the missing work</button>}
        <Link className="text-button" href="/support">Contact support</Link>
      </div>
    </>}
  </div>;
}

export const quoteLabel: Record<QuoteScope, string> = { frame: 'Storyboard frames', characters: 'Identity sheets', character: 'One identity redraw', video: 'Scene clips', scene: 'One scene revision', export: 'Final assembly' };
export const describeQuote = (q: Quote) => `${quoteLabel[q.scope]} · ${q.tasks.length} item${q.tasks.length === 1 ? '' : 's'}`;
