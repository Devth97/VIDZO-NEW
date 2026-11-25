'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Film, Clock3, Sparkles, Play, SlidersHorizontal, Trash2, Check } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { ErrorMessage, Modal, ProductArt } from '@/components/ui';
import { steps, type Project } from '@/lib/domain/schema';
import { totalSeconds } from '@/lib/domain/project';

const statusText: Record<Project['status'], string> = { draft: 'Draft', analyzing: 'Analysing', generating: 'In production', review: 'In review', ready: 'Ready', failed: 'Needs attention' };

export default function ProjectsPage() {
  const { projects, backend, demo, upsert, remove } = useWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [open, setOpen] = useState(false), [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [doomed, setDoomed] = useState<Project | null>(null);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('new')) setOpen(true); }, []);
  async function start(sample = false) {
    setBusy(true); setError('');
    try { const p = await backend.createProject(name || 'Untitled project', sample); upsert(p); router.push('/studio/' + p.id); } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  async function destroy() {
    if (!doomed) return;
    setBusy(true);
    try { await backend.deleteProject(doomed.id); remove(doomed.id); setDoomed(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const shown = projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'draft' ? ['draft', 'analyzing', 'failed'].includes(p.status) : ['generating', 'review', 'ready'].includes(p.status))));
  const resume = projects[0];
  return <div className="page-container">
    <div className="page-heading"><div><p className="eyebrow">MAKE SOMETHING WORTH WATCHING</p><h1>Your creative space<span className="serif-dot">.</span></h1><p>Good references. Original ideas. Ads that feel like you.</p></div><div className="inline-actions">{demo && projects.length > 0 && <button className="text-button" onClick={() => void start(true)} disabled={busy}><Play size={15}/>Explore a sample</button>}<button className="button primary" onClick={() => setOpen(true)}><Plus size={18}/>New project</button></div></div>
    {resume ? <section className="resume-card panel"><div><span className="pill"><Clock3 size={14}/>PICK UP WHERE YOU LEFT OFF</span><h2>{resume.name}</h2><p className="muted">Step {resume.step + 1} of 7 · {steps[resume.step]} · {statusText[resume.status]}</p>
      <div className="progress-track" aria-label={`Step ${resume.step + 1} of 7`}>{steps.map((s, i) => <span key={s} className={i < resume.step ? 'done' : i === resume.step ? 'current' : ''} title={s}/>)}</div></div>
      <Link className="button ink" href={'/studio/' + resume.id}>Continue {steps[resume.step].toLowerCase()}</Link></section>
    : <section className="studio-welcome"><div className="welcome-copy"><span className="pill"><Sparkles size={14}/>A LITTLE INSPIRATION. A LOT OF YOU.</span><h2>Your next great ad<br/>starts with <em>a spark.</em></h2><p>Bring a reference you love. Make it distinctly yours. Review every frame before you spend a credit.</p>
      <div className="inline-actions"><button className="button ink" onClick={() => setOpen(true)}>Create your first ad<Plus size={17}/></button>{demo && <button className="text-button" onClick={() => void start(true)} disabled={busy}><Play size={15}/>Explore a sample</button>}</div>
      <span className="reassurance"><Check size={14}/>Drafts are free. Storyboard approval comes before any video spend.</span></div><div className="welcome-visual"><ProductArt/><span className="floating-note"><Film size={16}/><span>ILLUSTRATION<br/><strong>Not a generated ad</strong></span></span></div></section>}
    <div className="workflow-ribbon"><div><span className="step-marker">1</span><p><strong>Bring your reference</strong><small>Authorized, 5–30 seconds</small></p></div><div><span className="step-marker">2</span><p><strong>Make it your own</strong><small>Your product, cast and story</small></p></div><div><span className="step-marker">3</span><p><strong>Approve, then create</strong><small>Quoted credits, held until done</small></p></div></div>
    <section className="projects-section"><div className="section-head"><h2>Your projects <span className="count">{projects.length}</span></h2></div>
      <div className="project-toolbar"><div className="segmented" role="group" aria-label="Filter projects">{[['all', 'All'], ['draft', 'Drafts'], ['complete', 'In production & ready']].map(([key, label]) => <button key={key} aria-pressed={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
        <label className="search-input"><Search size={17}/><span className="sr-only">Search projects</span><input type="search" placeholder="Search projects…" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
      <ErrorMessage message={error}/>
      <div className="project-grid">
        {shown.map((p, i) => <div className="project-card-wrap" key={p.id}><Link className="project-card" href={'/studio/' + p.id}>
          <div className="project-cover"><ProductArt variant={i} small/><span className={'project-status status-' + p.status}>{p.sample ? 'Sample · ' : ''}{statusText[p.status]}</span><span className="cover-format">9:16 · {totalSeconds(p)} SEC</span></div>
          <div className="project-details"><h3>{p.name}</h3><div><span>{p.brief.brand || 'Your brand'} · {steps[p.step]}</span><span><Clock3 size={13}/>{new Date(p.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div></div></Link>
          <button className="icon-button card-delete" aria-label={`Delete ${p.name}`} onClick={() => setDoomed(p)}><Trash2 size={16}/></button></div>)}
        {!query && filter === 'all' && <button className="create-card" onClick={() => setOpen(true)}><span className="create-circle"><Plus size={26}/></span><strong>A fresh idea starts here</strong><span>Create a new project</span></button>}
        {shown.length === 0 && (query || filter !== 'all') && <div className="empty-state"><SlidersHorizontal/><h3>No projects here yet</h3><p>Try another search or create your next idea.</p><button className="button secondary" onClick={() => { setFilter('all'); setQuery(''); }}>Clear filters</button></div>}
      </div>
    </section>
    <Modal title="A new idea starts here" open={open} close={() => setOpen(false)}><p>Give your project a name. You can change it later.</p>
      <form onSubmit={e => { e.preventDefault(); void start(); }}><label htmlFor="project-name">Project name</label><input data-autofocus id="project-name" maxLength={100} required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer collection launch"/><ErrorMessage message={error}/><button className="button primary full" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button><p className="small-text muted" style={{ marginTop: 12 }}>No credits needed to create a draft.</p></form></Modal>
    <Modal title="Delete this project?" open={Boolean(doomed)} close={() => setDoomed(null)}><p><strong>{doomed?.name}</strong> will be removed from your workspace. {demo ? 'It is deleted from this browser and cannot be recovered.' : 'Files are retained for the disclosed retention period, then deleted.'}</p>
      <div className="inline-actions" style={{ marginTop: 20 }}><button className="button danger" onClick={() => void destroy()} disabled={busy}>Delete project</button><button className="button secondary" onClick={() => setDoomed(null)}>Keep it</button></div></Modal>
  </div>;
}
