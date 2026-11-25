import Link from 'next/link';
import { ArrowUpRight, Clapperboard, FolderOpen, ImagePlus, Layers3, Plus, ScanLine, Settings2, Users } from 'lucide-react';
import { CreationComposer } from './creation-composer';

/** The landing workspace uses the real draft form; media is added inside the private studio. */
export function CreativeWorkspace() {
  return <section className="creative-workspace" aria-labelledby="workspace-title" id="new-draft">
    <nav className="creative-rail" aria-label="Studio shortcuts">
      <p className="rail-label">STUDIO</p>
      <a href="#new-draft" className="rail-current" aria-current="location"><Plus size={17}/>New draft</a>
      <Link href="/projects"><FolderOpen size={17}/>Projects</Link>
      <Link href="/assets"><ImagePlus size={17}/>Brand assets</Link>
      <Link href="/characters"><Users size={17}/>Characters</Link>
      <div className="rail-note"><span className="status-dot"/>Private beta<p>Draft first.<br/>Approve before spending.</p></div>
    </nav>
    <div className="creative-desk">
      <div className="desk-toolbar"><span><Clapperboard size={16}/>New project</span><span>Product ad · 9:16</span></div>
      <div className="desk-content">
        <div className="desk-heading"><p className="eyebrow">YOUR CREATIVE WORKSPACE</p><h1 id="workspace-title">What are we making?</h1><p>Start with a name and a goal. Bring your reference and product into the studio next.</p></div>
        <CreationComposer variant="hero"/>
        <p className="desk-reassurance">Free to draft. No card needed. Generation is quoted separately.</p>
        <div className="desk-next"><span>HAVE A PROJECT ALREADY?</span><Link href="/projects">Pick up where you left off<ArrowUpRight size={16}/></Link></div>
      </div>
    </div>
    <aside className="creative-inspector" aria-labelledby="inputs-title">
      <div className="inspector-heading"><Settings2 size={16}/><h2 id="inputs-title">Project checklist</h2></div>
      <p>Add these after creating your draft.</p>
      <ul className="input-checklist">
        <li><ScanLine size={19}/><div><h3>Reference video</h3><p>A reference you own or have permission to use.</p><small>MP4 or MOV · 5–30 sec</small></div></li>
        <li><ImagePlus size={19}/><div><h3>Your product</h3><p>Clear photos of the actual product and your exact logo.</p></div></li>
        <li><Users size={19}/><div><h3>Cast &amp; direction</h3><p>Choose characters when needed. Review the brief and every scene.</p></div></li>
      </ul>
      <div className="inspector-bottom"><Layers3 size={18}/><p>Your storyboard comes next.<br/><span>You review it before the quote.</span></p></div>
    </aside>
  </section>;
}
