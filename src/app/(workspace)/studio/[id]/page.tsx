'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check, ShieldCheck, CloudOff, AlertTriangle, RotateCcw } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { ErrorMessage, Loading, Modal } from '@/components/ui';
import { ReferenceStep, AnalysisStep } from '@/components/studio/reference-analysis';
import { CharactersStep, BrandStep } from '@/components/studio/characters-brand';
import { StoryboardStep, GenerateStep, ExportStep } from '@/components/studio/storyboard-generate';
import { useProjectEditor } from '@/components/studio/use-project';
import { describeQuote, jobActive, useJob, type StudioActions } from '@/components/studio/shared';
import { createDemoBackend } from '@/components/backend';
import { stepBlocker, totalSeconds } from '@/lib/domain/project';
import { steps, type JobView, type Quote, type QuoteScope, type Tier } from '@/lib/domain/schema';

const intro = [
  ['Start with a little inspiration.', 'An authorized reference is the starting point. Your original story is the destination.'],
  ['Find the spark in the story.', 'Review the concept, hook and shot breakdown. Correct anything that doesn’t feel right.'],
  ['Meet your original cast.', 'Distinct identities, approved by you. No lookalikes taken from the reference.'],
  ['Make the story unmistakably yours.', 'Your product, your visual language, your point of view.'],
  ['Every frame, considered.', 'Shape the story one scene at a time. Approve the frames before spending on video.'],
  ['From a good idea to a great ad.', 'Choose your production tier, review the quote and confirm the maximum spend.'],
  ['One last look. All yours.', 'Review the product, identity, logo and call to action before delivery.'],
];
const saveText = { saved: 'All changes saved', pending: 'Unsaved changes…', saving: 'Saving…', offline: 'Offline — will retry', error: 'Not saved', conflict: 'Changed elsewhere' } as const;

export default function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ctx = useWorkspace();
  const { project, change, flush, adopt, reload, saveState, saveError } = useProjectEditor(id);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [tier, setTier] = useState<Tier>('professional');
  const [quote, setQuote] = useState<Quote>(), [jobId, setJobId] = useState<string>();
  const lock = useRef(false);
  const projectRef = useRef(project); projectRef.current = project;

  // Resume a job that was running when the page was opened.
  useEffect(() => { if (project?.activeJobId && !jobId) setJobId(project.activeJobId); }, [project?.activeJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSettled = useCallback(async (j: JobView) => {
    try { adopt(await ctx.backend.getProject(id)); } catch { /* keep current */ }
    void ctx.refresh();
    if (j.status === 'failed') setError(j.error ?? 'The job failed. Unsettled credits were released.');
    else ctx.notify(j.kind === 'analysis' ? 'Analysis ready. Review it before continuing.' : j.status === 'review' ? 'Ready for your review.' : 'Done. Your new work is below.');
  }, [adopt, ctx, id]);
  const job = useJob(jobId, onSettled);

  async function guarded(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); }
  }
  const ensureSaved = async () => { if (!(await flush())) throw new Error('Your latest edits are not saved yet. Resolve the save problem first.'); };

  const actions: StudioActions = {
    change, flush, busy: busy || jobActive(job?.status), job: job && (jobActive(job.status) || job.status === 'failed' || job.status === 'review') ? job : undefined,
    requestQuote: (scope: QuoteScope, targetId?: string) => void guarded(async () => { await ensureSaved(); setQuote(await ctx.backend.quote(projectRef.current!, tier, scope, targetId)); }),
    approve: (sceneId, frameAssetId) => guarded(async () => { await ensureSaved(); adopt(await ctx.backend.approve(projectRef.current!, sceneId, frameAssetId)); }),
    upload: async (file, kind) => {
      await ensureSaved();
      const asset = await ctx.backend.upload(projectRef.current!, file, kind);
      adopt(await ctx.backend.getProject(id));
      return asset;
    },
    analyze: () => guarded(async () => {
      await ensureSaved();
      const j = await ctx.backend.analyze(projectRef.current!);
      if (ctx.demo) { adopt(await ctx.backend.getProject(id)); ctx.notify('Illustrative analysis added. Edit it to match your reference.'); }
      else setJobId(j.id);
    }),
    retry: jobIdToRetry => void guarded(async () => { await ensureSaved(); setQuote(await ctx.backend.retry(jobIdToRetry)); }),
  };

  async function confirm() {
    if (!quote) return;
    await guarded(async () => {
      if (Date.now() >= quote.expiresAt) throw new Error('This quote expired. Request a fresh one.');
      const j = await ctx.backend.submit(quote, quote.id); // the quote id is the idempotency key: repeat clicks reuse the same job
      setQuote(undefined); setJobId(j.id);
      void ctx.refresh();
      ctx.notify(ctx.demo ? 'Simulation started. No provider is called and no money is spent.' : 'Queued. Credits are held until each item finishes.');
    });
  }

  async function go(step: number) {
    const p = projectRef.current; if (!p) return;
    setError('');
    const blocker = stepBlocker(p, step);
    if (step > p.step && blocker) { setError(blocker); return; }
    change({ ...p, step });
    await flush();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  if (!ctx.ready || (project === null && !ctx.signedOut && ctx.projects.length === 0 && !ctx.error)) return <Loading/>;
  if (!project) return <div className="page-container"><div className="empty-state"><h1>Project not found</h1><p>It may belong to another workspace or device.</p><Link className="button primary" href="/projects">Back to projects</Link></div></div>;
  const props = { project, actions };
  const nextBlocker = project.step < 6 ? stepBlocker(project, project.step + 1) : null;
  const SaveIcon = saveState === 'offline' ? CloudOff : saveState === 'error' || saveState === 'conflict' ? AlertTriangle : Check;
  return <div className="page-container">
    <div className="studio-header">
      <Link className="icon-button" href="/projects" aria-label="Back to projects"><ChevronLeft size={22}/></Link>
      <h1 className="sr-only">{project.name} studio</h1>
      <label htmlFor="studio-project-name" className="sr-only">Project name</label>
      <input id="studio-project-name" maxLength={100} value={project.name} onChange={e => change({ ...project, name: e.target.value })}/>
      <span className="studio-slate" aria-label={`Vertical 9:16, ${totalSeconds(project)} seconds`}>9:16 · {totalSeconds(project)} s</span>
      <span className={'save-label state-' + saveState} role="status"><SaveIcon size={14}/>{saveText[saveState]}{ctx.demo && saveState === 'saved' ? ' on this device' : ''}</span>
    </div>
    {(saveState === 'conflict' || saveState === 'error') && <div className="notice warning" role="alert"><AlertTriangle size={16}/><span>{saveError}</span>{saveState === 'conflict' && <button className="button secondary" onClick={() => void reload()}><RotateCcw size={14}/>Load latest version</button>}{saveState === 'error' && <button className="button secondary" onClick={() => void flush()}>Try again</button>}</div>}
    <nav aria-label="Creation steps"><ol className="stepper" style={{ ['--progress' as string]: project.step / (steps.length - 1) }}>{steps.map((label, i) => {
      const locked = i > project.step && Boolean(stepBlocker(project, i));
      return <li key={label}><button aria-current={project.step === i ? 'step' : undefined} aria-disabled={locked} className={locked ? 'is-locked' : ''} onClick={() => void go(i)} title={locked ? stepBlocker(project, i) ?? undefined : undefined}><span className="step-dot">{i < project.step ? <Check size={14}/> : i + 1}</span>{label}</button></li>;
    })}</ol></nav>
    <div className={'studio-intro step-tone-' + project.step}><div><h2>{intro[project.step][0]}</h2><p>{intro[project.step][1]}</p></div><span className="badge">Step {project.step + 1} of 7</span></div>
    <ErrorMessage message={error}/>
    {project.step === 0 && <ReferenceStep {...props}/>}
    {project.step === 1 && <AnalysisStep {...props}/>}
    {project.step === 2 && <CharactersStep {...props}/>}
    {project.step === 3 && <BrandStep {...props}/>}
    {project.step === 4 && <StoryboardStep {...props}/>}
    {project.step === 5 && <GenerateStep {...props} tier={tier} setTier={setTier}/>}
    {project.step === 6 && <ExportStep {...props} onSimulateReview={ctx.demo ? () => void guarded(async () => { adopt(await (ctx.backend as ReturnType<typeof createDemoBackend>).reviewExport(project.id)); }) : undefined}/>}
    <div className="studio-bottom">
      <button className="button secondary" disabled={project.step === 0 || busy} onClick={() => void go(project.step - 1)}>Previous</button>
      {nextBlocker && <span className="small-text muted next-hint">{nextBlocker}</span>}
      {project.step < 6 ? <button className="button primary" disabled={busy || Boolean(nextBlocker)} onClick={() => void go(project.step + 1)}>Continue to {steps[project.step + 1]}</button> : <Link className="button secondary" href="/projects">Back to projects</Link>}
    </div>
    <Modal open={Boolean(quote)} close={() => { if (!busy) setQuote(undefined); }} title={quote?.illustrative ? 'Review your quote (placeholder pricing)' : 'Confirm your maximum spend'}>
      {quote && <>
        <div className="notice"><ShieldCheck size={18}/>{ctx.demo ? 'Explore mode: simulated credits, placeholder outputs, no provider calls.' : quote.illustrative ? 'Local test backend: placeholder pricing and labelled placeholder outputs. No provider is called.' : 'You will never be charged more than this without new consent.'}</div>
        <div className="quote-detail"><span>Work</span><strong>{describeQuote(quote)}</strong></div>
        <div className="quote-detail"><span>Maximum credits</span><strong>{quote.credits}</strong></div>
        <div className="quote-detail"><span>Available now</span><strong>{ctx.wallet.available}</strong></div>
        <div className="quote-detail"><span>Model</span><strong>{quote.model}</strong></div>
        <div className="quote-detail"><span>Native output</span><strong>{quote.nativeResolution}</strong></div>
        <div className="quote-detail"><span>Quote expires</span><strong>{new Date(quote.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong></div>
        <p className="small-text muted" style={{ margin: '16px 0 20px' }}>{quote.retryPolicy}</p>
        <ErrorMessage message={error}/>
        <button className="button primary full" onClick={() => void confirm()} disabled={busy || ctx.wallet.available < quote.credits}>{busy ? 'Submitting…' : ctx.wallet.available < quote.credits ? 'Not enough credits' : quote.credits === 0 ? 'Confirm · no credits' : `Confirm up to ${quote.credits} credits`}</button>
        {ctx.wallet.available < quote.credits && <Link className="text-button" href="/wallet">Add credits to your wallet</Link>}
      </>}
    </Modal>
  </div>;
}
