'use client';
import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check, Sparkles, ShieldCheck } from 'lucide-react';
import { useWorkspace, api } from '@/components/workspace-provider';
import { ErrorMessage, Loading, Modal } from '@/components/ui';
import { ReferenceStep, AnalysisStep } from '@/components/studio/reference-analysis';
import { CharactersStep, BrandStep } from '@/components/studio/characters-brand';
import { StoryboardStep, GenerateStep, ExportStep } from '@/components/studio/storyboard-generate';
import { steps, type Project, type Quote, type Tier } from '@/lib/domain/schema';
import { assertQuote, createQuote, reserve, finish } from '@/lib/domain/project';

const intro = [
  ['Start with a little inspiration.', 'An authorized reference is the starting point. Your original story is the destination.'],
  ['Find the spark in the story.', 'Review the concept, hook and shot breakdown. Correct anything that doesn’t feel right.'],
  ['Meet your original cast.', 'Distinct identities, approved by you. No lookalikes taken from the reference.'],
  ['Make the story unmistakably yours.', 'Your product, your visual language, your point of view.'],
  ['Every frame, considered.', 'Shape the story one scene at a time. Approve the frames before spending on video.'],
  ['From a good idea to a great ad.', 'Choose your production tier, review the quote and set the maximum spend.'],
  ['One last look. All yours.', 'Review the product, identity, logo and call to action before delivery.'],
];
export default function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const ctx = useWorkspace(); const stored = ctx.projects.find(p => p.id === id);
  const [project, setProject] = useState<Project | null>(null), [error, setError] = useState(''), [saving, setSaving] = useState(false), [busy, setBusy] = useState(false), [tier, setTier] = useState<Tier>('professional'), [quote, setQuote] = useState<Quote>(), [confirm, setConfirm] = useState(false), [scope, setScope] = useState('video'), [target, setTarget] = useState<string>(), [job, setJob] = useState<{ id: string; status: string; stage?: string; error?: string }>();
  const changed = useRef(false); const mutex = useRef(false); const latest = useRef<Project | null>(null); latest.current = project;
  useEffect(() => { if (stored && (!project || !changed.current)) setProject(stored); }, [stored]);
  useEffect(() => { if (!project || !changed.current) return; setSaving(true); const timer = setTimeout(() => { void ctx.save(project).then(() => { changed.current = false; setSaving(false); }).catch(e => { setError(e.message); setSaving(false); }); }, 650); return () => clearTimeout(timer); }, [project]);
  useEffect(() => { if (!job || ['succeeded', 'failed', 'review'].includes(job.status) || ctx.demo) return; let active = true; let timer: ReturnType<typeof setTimeout>; let delay = 2000;
    async function poll() { try { const next = await api<typeof job>('/api/jobs/' + job!.id); if (!active || !next) return; setJob(next); if (['succeeded', 'review', 'failed'].includes(next.status)) { changed.current = false; await ctx.refresh(); setBusy(false); if (next.status === 'failed') setError(next.error || 'Generation failed; unsettled credits were released.'); else ctx.notify('Your job is ready for review.'); } else { delay = Math.min(delay * 1.4, 15000); timer = setTimeout(poll, delay); } } catch (e) { if (active) { setError((e as Error).message); timer = setTimeout(poll, 15000); } } }
    timer = setTimeout(poll, delay); return () => { active = false; clearTimeout(timer); }; }, [job?.id]);
  useEffect(() => { if (!ctx.demo && stored?.jobId && !job) setJob({ id: stored.jobId, status: stored.status }); }, [stored?.jobId]);
  function change(p: Project) { changed.current = true; setProject(p); setQuote(undefined); }
  async function go(step: number) { if (!project) return; setError(''); try {
    if (step > 0 && (!project.rights || (!project.sample && !project.assets.some(a => a.kind === 'reference')))) throw new Error('Add a reference and confirm your rights first.');
    if (step > 1 && !project.analysis) throw new Error('Review your reference analysis first.');
    if (step > 2 && project.analysis?.roles.some(r => !project.characters.some(c => c.roleId === r.id && c.approved))) throw new Error('Select an original identity for each role.');
    if (step > 3 && (!project.brief.brand.trim() || !project.brief.product.trim() || !project.brief.cta.trim() || !project.brief.differences.trim())) throw new Error('Add your brand, product, call to action and original creative differences.');
    if (step > 4 && !project.scenes.every(s => s.approved)) throw new Error('Approve every storyboard frame first.');
    const next = { ...project, step }; await ctx.save(next); changed.current = false; setProject(next); window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (e) { setError((e as Error).message); } }
  async function run(action: string, targetId?: string) { if (!project || mutex.current) return; mutex.current = true; setBusy(true); setError(''); setScope(action); setTarget(targetId);
    try { await ctx.save(project); let q: Quote;
      if (ctx.demo) { q = action === 'video' ? createQuote(project, tier) : { id: crypto.randomUUID(), projectId: project.id, fingerprint: '', tier, credits: action === 'export' ? 0 : action === 'frame' ? 5 : action === 'characters' ? 15 : action === 'scene' ? 50 : 5, seconds: 0, expiresAt: Date.now() + 15 * 60000, nativeResolution: 'Illustrative', model: 'Demo simulation', scope: action }; }
      else q = await api<Quote>('/api/quotes', { projectId: project.id, tier, scope: action, targetId });
      setQuote(q); setConfirm(true);
    } catch (e) { setError((e as Error).message); } finally { mutex.current = false; setBusy(false); }
  }
  async function submit() { if (!project || !quote || mutex.current) return; mutex.current = true; setBusy(true); setError('');
    try {
      if (ctx.demo) {
        if (Date.now() >= quote.expiresAt) throw new Error('This quote expired. Request another.');
        if (scope === 'video') assertQuote(project, quote);
        let w = ctx.wallet; if (quote.credits) w = reserve(w, quote.credits, quote.id);
        if (quote.credits) w = finish(w, quote.credits, quote.id, true);
        ctx.changeWallet(w);
        if (scope === 'video') { const next = { ...project, status: 'review' as const, step: 6 }; await ctx.save(next); setProject(next); changed.current = false; }
        if (scope === 'frame') { const next = { ...project, scenes: project.scenes.map(s => s.id === target ? { ...s, version: s.version + 1, approved: false, frameApproved: false, frameKey: undefined, clipUrl: undefined, history: [...s.history, { version: s.version, prompt: s.prompt }] } : s), exportUrl: undefined }; change(next); }
        if (scope === 'character') change({ ...project, characters: project.characters.map(c => c.id === target ? { ...c, approved: false, version: c.version + 1, history: [...c.history, { version: c.version }] } : c), scenes: project.scenes.map(s => ({ ...s, approved: false, frameApproved: false, clipUrl: undefined })), exportUrl: undefined });
        ctx.notify('Demo completed. Credits are simulated; no image or video was generated.');
      } else { const j = await api<{ id: string; status: string }>('/api/jobs', { projectId: project.id, quoteId: quote.id, idempotencyKey: quote.id }); setJob(j); changed.current = false; await ctx.refresh(); ctx.notify('Job queued. You can leave and return to this project.'); }
      setConfirm(false);
    } catch (e) { setError((e as Error).message); } finally { mutex.current = false; setBusy(false); }
  }
  if (!ctx.ready) return <Loading/>;
  if (!project) return <div className="page-container"><div className="empty-state"><h1>Project not found</h1><p>This project may be on another device or workspace.</p><Link className="button primary" href="/projects">Back to projects</Link></div></div>;
  const props = { project, change, run, busy };
  return <div className="page-container"><div className="studio-header"><Link className="icon-button" href="/projects" aria-label="Back to projects"><ChevronLeft size={22}/></Link><h1 className="sr-only">{project.name} studio</h1><label htmlFor="studio-project-name" className="sr-only">Project name</label><input id="studio-project-name" maxLength={100} value={project.name} onChange={e => change({ ...project, name: e.target.value })}/><span className="save-label">{saving ? 'Saving…' : ctx.demo ? 'Saved on this device' : 'Workspace draft'}</span></div>
    <nav aria-label="Creation steps"><ol className="stepper">{steps.map((label, i) => <li key={label}><button aria-current={project.step === i ? 'step' : undefined} onClick={() => void go(i)}><span className="step-dot">{i < project.step ? <Check size={14}/> : i + 1}</span>{label}</button></li>)}</ol></nav>
    <div className="studio-intro"><div><h2>{intro[project.step][0]}</h2><p>{intro[project.step][1]}</p></div><span className="badge">STEP {project.step + 1} OF 7</span></div><ErrorMessage message={error}/>
    {job && !['succeeded', 'failed'].includes(job.status) && <div className="notice"><Sparkles size={18}/><span><strong>{job.status === 'review' ? 'Awaiting human review' : job.stage || job.status}</strong> · Your job is saved in the background. No invented percentage; we show the actual stage.</span></div>}
    {project.step === 0 && <ReferenceStep {...props}/>}{project.step === 1 && <AnalysisStep {...props}/>}{project.step === 2 && <CharactersStep {...props}/>}{project.step === 3 && <BrandStep {...props}/>}{project.step === 4 && <StoryboardStep {...props}/>}{project.step === 5 && <GenerateStep {...props} tier={tier} setTier={t => { setTier(t); setQuote(undefined); }} quote={quote}/>}{project.step === 6 && <ExportStep {...props}/>}
    <div className="studio-bottom"><button className="button secondary" disabled={project.step === 0 || busy} onClick={() => void go(project.step - 1)}>Previous step</button>{project.step < 6 && <button className="button primary" disabled={busy} onClick={() => void go(project.step + 1)}>Continue to {steps[project.step + 1]}</button>}{project.step === 6 && <Link className="button secondary" href="/projects">Back to projects</Link>}</div>
    <Modal open={confirm} close={() => { if (!busy) setConfirm(false); }} title={ctx.demo ? 'Review the demo quote' : 'Confirm your maximum spend'}>{quote && <><div className="notice"><ShieldCheck size={18}/>{ctx.demo ? 'Simulated credits only. No money or provider calls.' : 'You will never be charged more than this quote without new consent.'}</div><div className="quote-detail"><span>Action</span><strong>{scope === 'video' ? 'Generate scene clips' : scope === 'frame' ? 'One storyboard frame' : scope === 'export' ? 'Final assembly' : scope === 'scene' ? 'One scene revision' : 'Character identity sheets'}</strong></div><div className="quote-detail"><span>Maximum credits</span><strong>{quote.credits}</strong></div><div className="quote-detail"><span>Available</span><strong>{ctx.wallet.available}</strong></div><div className="quote-detail"><span>Native output</span><strong>{quote.nativeResolution}</strong></div><div className="quote-detail"><span>Quote expires</span><strong>{new Date(quote.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong></div><p className="small-text muted" style={{ margin: '20px 0' }}>Technical failure releases unsettled credits. Creative redraws are separate paid actions. Product quality concerns go to review first.</p><ErrorMessage message={error}/><button className="button primary full" onClick={() => void submit()} disabled={busy || ctx.wallet.available < quote.credits}>{busy ? 'Submitting…' : ctx.wallet.available < quote.credits ? 'Insufficient credits' : ctx.demo ? 'Confirm demo simulation' : `Confirm up to ${quote.credits} credits`}</button>{ctx.wallet.available < quote.credits && <Link className="text-button" href="/wallet">Add credits to your wallet</Link>}</>}</Modal>
  </div>;
}
