'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { ConceptImage, concepts } from './concept-image';
import { Modal } from './ui';

export function ConceptGallery({ compact = false }: { compact?: boolean }) {
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<(typeof concepts)[number] | null>(null);
  const shown = concepts.filter(c => category === 'All' || c.category === category);
  return <>
    {!compact && <div className="concept-filters" role="group" aria-label="Filter concepts">{['All', 'Beauty', 'Electronics', 'Jewelry'].map(item => <button key={item} type="button" aria-pressed={category === item} className={category === item ? 'is-selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>}
    <p className="concept-disclosure">AI-created concept stills · not finished videos or customer work</p>
    {!compact && <p className="sr-only" role="status">{shown.length} {shown.length === 1 ? 'concept' : 'concepts'} shown for {category.toLowerCase()}</p>}
    <div className="concept-grid">{shown.map(c => <button key={c.id} className="concept-card" onClick={() => setSelected(c)} aria-label={`Explore ${c.category.toLowerCase()} concept: ${c.title}`}>
      <div className="concept-card-media"><ConceptImage id={c.id}/><span className="concept-index">0{concepts.indexOf(c) + 1} / DIRECTION</span><span className="concept-open" aria-hidden="true"><ArrowUpRight size={20}/></span></div>
      <span className="concept-card-meta"><span>{c.category}</span><span>CONCEPT STILL</span></span><h3>{c.title}</h3>
    </button>)}</div>
    <Modal open={Boolean(selected)} close={() => setSelected(null)} title={selected?.title ?? 'Creative direction'}>{selected && <div className="concept-detail"><ConceptImage id={selected.id}/><div><p className="eyebrow">{selected.category} / CREATIVE DIRECTION</p><p>{selected.direction}</p><p className="muted small-text">This is an AI-created still for exploring art direction. Your project uses the product photos and reference you provide. It is not a video produced by VIDZO.</p><Link className="button primary" href="/projects?new=1">Start your own draft<ArrowRight size={16}/></Link></div></div>}</Modal>
  </>;
}
