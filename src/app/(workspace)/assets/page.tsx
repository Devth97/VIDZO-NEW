'use client';
import Link from 'next/link';
import { Image as ImageIcon } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { PrivateMedia } from '@/components/studio/shared';

export default function AssetsPage() {
  const { projects } = useWorkspace();
  const groups = projects.map(p => ({ p, files: p.assets.filter(a => (a.kind === 'product' || a.kind === 'logo') && a.status === 'verified') })).filter(g => g.files.length);
  return <div className="page-container">
    <div className="page-heading"><div><p className="eyebrow">Brand assets</p><h1>Your originals, untouched<span className="serif-dot">.</span></h1><p>Product photos and logos are stored exactly as uploaded and used as the source of truth for every frame and overlay.</p></div></div>
    {groups.length === 0 ? <div className="empty-state panel"><ImageIcon size={28}/><h2>No brand files yet</h2><p>Add product photos and your logo in a project’s Brand & brief step.</p><Link className="button primary" href="/projects">Go to projects</Link></div>
      : groups.map(({ p, files }) => <section key={p.id} className="projects-section"><div className="section-head"><h2>{p.brief.brand || p.name}</h2><Link className="text-button" href={'/studio/' + p.id}>Open project</Link></div>
        <div className="thumb-grid">{files.map(a => <figure key={a.id}><PrivateMedia asset={a} alt={`${a.kind}: ${a.name}`}/><figcaption>{a.kind === 'logo' ? 'Logo' : 'Product'} · {a.name} · {a.width}×{a.height}</figcaption></figure>)}</div></section>)}
  </div>;
}
