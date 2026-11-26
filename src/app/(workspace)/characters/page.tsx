'use client';
import Link from 'next/link';
import { Users, Check } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { PrivateMedia } from '@/components/studio/shared';
import { currentSheet, sheetHistory } from '@/lib/domain/project';

export default function CharactersPage() {
  const { projects } = useWorkspace();
  const rows = projects.flatMap(p => p.candidates.map(c => ({ p, c, sheet: currentSheet(p, c.id), versions: sheetHistory(p, c.id).length, selected: p.selections[c.roleId] === c.id }))).filter(r => r.sheet);
  return <div className="page-container">
    <div className="page-heading"><div><p className="eyebrow">Characters</p><h1>An original cast<span className="serif-dot">.</span></h1><p>Identity sheets you created, with every version kept. Selected identities are used in your scenes.</p></div></div>
    {rows.length === 0 ? <div className="empty-state panel"><Users size={28}/><h2>No identity sheets yet</h2><p>When a reference has people, create original identities in the project’s Characters step. Product-only concepts need none.</p><Link className="button primary" href="/projects">Go to projects</Link></div>
      : <div className="candidate-grid">{rows.map(({ p, c, sheet, versions, selected }) => <article key={c.id} className={'candidate-card ' + (selected ? 'selected' : '')}><div className="candidate-portrait"><PrivateMedia asset={sheet} alt={`${c.name} identity sheet`}/></div>
        <div className="candidate-info"><strong>{c.name}</strong><p>{c.description}</p><span className="badge">{versions} version{versions > 1 ? 's' : ''}{selected ? ' · selected' : ''}</span>{selected && <Check size={14}/>}<Link className="text-button" href={'/studio/' + p.id}>{p.name}</Link></div></article>)}</div>}
  </div>;
}
