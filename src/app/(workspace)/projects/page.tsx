'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SegmentedControl, SegmentedControlItem, DropdownMenu } from '@astryxdesign/core';
import { Search, Clock3, Play, SlidersHorizontal, Trash2, ArrowRight, Wallet, Image as ImageIcon, MoreHorizontal, FolderOpen, Sparkles } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { ErrorMessage, Modal, MediaPlaceholder } from '@/components/ui';
import { CreationComposer } from '@/components/creation-composer';
import { takeDraftIntent, type DraftIntent } from '@/lib/draft-intent';
import { steps, type Project } from '@/lib/domain/schema';
import { totalSeconds } from '@/lib/domain/project';
import { nextAction } from '@/lib/next-action';

const statusText: Record<Project['status'], string> = { draft: 'Draft', analyzing: 'Analysing', generating: 'In production', review: 'In review', ready: 'Ready', failed: 'Needs attention' };
const filters = { all: 'All', progress: 'In progress', production: 'In production', ready: 'Ready' } as const;
type Filter = keyof typeof filters;
const matches = (p: Project, f: Filter) => f === 'all' || (f === 'progress' ? ['draft', 'analyzing', 'failed'].includes(p.status) : f === 'production' ? ['generating', 'review'].includes(p.status) : p.status === 'ready');

export default function ProjectsPage() {
  const { projects, backend, demo, upsert, remove, wallet, mode } = useWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<Filter>('all'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [doomed, setDoomed] = useState<Project | null>(null);
  const [intent, setIntent] = useState<DraftIntent | null>(null), [focusComposer, setFocusComposer] = useState(false);

  useEffect(() => {
    const pending = takeDraftIntent();
    if (pending) setIntent(pending);
    if (pending || new URLSearchParams(window.location.search).get('new')) setFocusComposer(true);
  }, []);

  async function create(i: DraftIntent) {
    const p = await backend.createProject(i.name);
    // The brief is a draft field; the server merges it under its normal rules.
    const withBrief = (i.brand || i.product || i.objective !== p.brief.objective)
      ? await backend.saveProject({ ...p, brief: { ...p.brief, objective: i.objective, brand: i.brand, product: i.product } }, p.revision)
      : p;
    upsert(withBrief);
    router.push('/studio/' + p.id);
  }
  const sampling = useRef(false);
  async function sample() {
    if (sampling.current) return;
    sampling.current = true; setBusy(true); setError('');
    try { const p = await backend.createProject('Sample', true); upsert(p); router.push('/studio/' + p.id); } catch (e) { setError((e as Error).message); setBusy(false); sampling.current = false; }
  }
  async function destroy() {
    if (!doomed) return;
    setBusy(true);
    try { await backend.deleteProject(doomed.id); remove(doomed.id); setDoomed(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const sorted = useMemo(() => [...projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)), [projects]);
  const shown = sorted.filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase()) && matches(p, filter));
  const counts = Object.fromEntries((Object.keys(filters) as Filter[]).map(f => [f, projects.filter(p => matches(p, f)).length])) as Record<Filter, number>;
  const resume = sorted.find(p => p.status !== 'ready') ?? sorted[0];

  return <div className="page-container workspace-home">
    <div className="workspace-greeting"><div><p className="eyebrow">YOUR STUDIO</p><h1>What are we making<span className="serif-dot">?</span></h1></div>
      {demo && <button className="text-button" onClick={() => void sample()} disabled={busy}><Play size={15}/>Explore the sample project</button>}</div>

    <div className="workspace-top">
      <CreationComposer variant="workspace" initial={intent} onCreate={create} autoFocus={focusComposer}/>
      <aside className="workspace-side" aria-label="Shortcuts">
        {resume ? <Link className="resume-tile" href={'/studio/' + resume.id}>
          <span className="pill"><Clock3 size={13}/>CONTINUE</span>
          <strong>{resume.name}</strong>
          <span className="resume-next">{nextAction(resume)}</span>
          <span className="progress-track" role="img" aria-label={`Step ${resume.step + 1} of 7: ${steps[resume.step]}`}>{steps.map((s, i) => <span key={s} className={i < resume.step ? 'done' : i === resume.step ? 'current' : ''}/>)}</span>
          <span className="resume-cta">Open project<ArrowRight size={15}/></span>
        </Link> : <div className="resume-tile is-empty"><span className="pill"><Sparkles size={13}/>FIRST PROJECT</span><strong>Your drafts will appear here</strong><span className="resume-next">Name your ad on the left to create one. Drafting is free.</span></div>}
        <Link className="shortcut" href="/wallet"><Wallet size={18}/><span><strong>{wallet.available} credits</strong><small>{wallet.held ? `${wallet.held} held for running work` : mode === 'demo' ? 'Simulated in explore mode' : 'Add credits before production'}</small></span><ArrowRight size={15}/></Link>
        <Link className="shortcut" href="/assets"><ImageIcon size={18}/><span><strong>Brand assets</strong><small>Product photos and logos you’ve added</small></span><ArrowRight size={15}/></Link>
      </aside>
    </div>

    <section className="projects-section" aria-labelledby="projects-title">
      <div className="section-head"><h2 id="projects-title">Projects <span className="count">{projects.length}</span></h2></div>
      {projects.length > 0 && <div className="project-toolbar">
        <SegmentedControl label="Filter projects by status" value={filter} onChange={v => setFilter(v as Filter)} size="sm">
          {(Object.keys(filters) as Filter[]).map(f => <SegmentedControlItem key={f} value={f} label={`${filters[f]} ${counts[f]}`}/>)}
        </SegmentedControl>
        <label className="search-input"><Search size={17}/><span className="sr-only">Search projects</span><input type="search" placeholder="Search projects…" value={query} onChange={e => setQuery(e.target.value)}/></label>
      </div>}
      <p className="sr-only" role="status">{shown.length} of {projects.length} projects shown</p>
      <ErrorMessage message={error}/>
      {projects.length === 0 ? <div className="empty-state panel"><FolderOpen size={26}/><h3>No projects yet</h3><p>Use the composer above to create your first draft. Nothing is charged until you approve a quote.</p></div>
        : <div className="project-grid">
          {shown.map(p => <article className="project-card-wrap" key={p.id}>
            <Link className="project-card" href={'/studio/' + p.id}>
              <div className="project-cover"><MediaPlaceholder small/><span className={'project-status status-' + p.status}>{p.sample ? 'Sample · ' : ''}{statusText[p.status]}</span><span className="cover-format">9:16 · {totalSeconds(p)} SEC</span></div>
              <div className="project-details"><h3>{p.name}</h3>
                <p className="project-next">{nextAction(p)}</p>
                <span className="progress-track small" role="img" aria-label={`Step ${p.step + 1} of 7`}>{steps.map((s, k) => <span key={s} className={k < p.step ? 'done' : k === p.step ? 'current' : ''}/>)}</span>
                <div><span>{p.brief.brand || 'No brand yet'}</span><span><Clock3 size={13}/>{new Date(p.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div></div>
            </Link>
            <div className="card-menu">
              <DropdownMenu button={{ label: `Actions for ${p.name}`, icon: <MoreHorizontal size={16}/>, isIconOnly: true, variant: 'ghost', size: 'sm' }} hasChevron={false} alignment="end"
                items={[{ label: 'Open project', icon: <ArrowRight size={15}/>, onClick: () => router.push('/studio/' + p.id) }, { type: 'divider' }, { label: 'Delete project…', icon: <Trash2 size={15}/>, variant: 'destructive', onClick: () => setDoomed(p) }]}/>
            </div>
          </article>)}
          {shown.length === 0 && <div className="empty-state"><SlidersHorizontal/><h3>Nothing matches</h3><p>Try another search or status.</p><button className="button secondary" onClick={() => { setFilter('all'); setQuery(''); }}>Clear filters</button></div>}
        </div>}
    </section>

    <Modal title="Delete this project?" open={Boolean(doomed)} close={() => setDoomed(null)}><p><strong>{doomed?.name}</strong> will be removed from your workspace. {demo ? 'It is deleted from this browser and cannot be recovered.' : 'Files are retained for the disclosed retention period, then deleted.'}</p>
      <div className="inline-actions" style={{ marginTop: 20 }}><button className="button danger" onClick={() => void destroy()} disabled={busy}>Delete project</button><button className="button secondary" onClick={() => setDoomed(null)}>Keep it</button></div></Modal>
  </div>;
}
