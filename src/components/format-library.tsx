'use client';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { saveDraftIntent, type Objective } from '@/lib/draft-intent';
import { Shot } from './hero-reel';

/**
 * Ad formats as starting structures, the way Arcads, Icon and MakeUGC lead with formats.
 * These are story structures, not results: picking one fills a draft brief you can rewrite.
 */
type Format = { name: string; objective: Objective; job: string; beats: string[]; tone: string; shot: string; overlay?: 'split' | 'list' | 'box' | 'steps' | 'offer' };

export const adFormats: Format[] = [
  { name: 'Product reveal', objective: 'Product launch', job: 'Tease the details, then show the whole product.', beats: ['Close detail', 'Full reveal', 'Where to get it'], tone: 'peach', shot: 'close' },
  { name: 'Problem to solution', objective: 'Product education', job: 'Show an everyday problem, then the product solving it.', beats: ['The problem', 'The product', 'The result'], tone: 'sage', shot: 'shelf', overlay: 'split' },
  { name: 'Unboxing', objective: 'Product launch', job: 'Hands open the pack. First look, then the hero detail.', beats: ['The pack', 'First look', 'Hero detail'], tone: 'butter', shot: 'light', overlay: 'box' },
  { name: 'Three reasons', objective: 'Brand awareness', job: 'One reason per scene, numbered on screen.', beats: ['Reason one', 'Reason two', 'Reason three'], tone: 'lavender', shot: 'orbit', overlay: 'list' },
  { name: 'How it works', objective: 'Product education', job: 'Three quick steps of the product in use.', beats: ['Step one', 'Step two', 'The payoff'], tone: 'cream', shot: 'shelf', overlay: 'steps' },
  { name: 'Seasonal offer', objective: 'Offer promotion', job: 'The product, the offer and the dates it runs.', beats: ['The product', 'The offer', 'Valid dates'], tone: 'peach', shot: 'end', overlay: 'offer' },
];

function Overlay({ kind }: { kind?: Format['overlay'] }) {
  if (kind === 'split') return <span className="fmt-split"><b>Before</b><b>After</b></span>;
  if (kind === 'list') return <span className="fmt-list"><b>1</b><b>2</b><b>3</b></span>;
  if (kind === 'box') return <span className="fmt-box"/>;
  if (kind === 'steps') return <span className="fmt-steps"><i/><i/><i/></span>;
  if (kind === 'offer') return <span className="fmt-offer">Your offer</span>;
  return null;
}

export function FormatLibrary() {
  const router = useRouter();
  const busy = useRef(false);
  function start(f: Format) {
    if (busy.current) return;
    busy.current = true;
    saveDraftIntent({ name: f.name, objective: f.objective, brand: '', product: '', direction: `${f.name}: ${f.job} Scenes: ${f.beats.join(' → ')}.` });
    router.push('/projects?new=1');
  }
  return <div className="format-grid">{adFormats.map(f => <article key={f.name} className="format-card">
    <div className={'format-thumb tone-' + f.tone} aria-hidden="true"><Shot shot={f.shot}/><Overlay kind={f.overlay}/><span className="reel-slate">9:16</span></div>
    <div className="format-body">
      <h3>{f.name}</h3><p>{f.job}</p>
      <ol className="format-beats">{f.beats.map((b, i) => <li key={b}><span>0{i + 1}</span>{b}</li>)}</ol>
      <button type="button" className="format-use" onClick={() => start(f)}>Use this format<ArrowRight size={14}/></button>
    </div>
  </article>)}</div>;
}
