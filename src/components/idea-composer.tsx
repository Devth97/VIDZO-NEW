'use client';
import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, ChevronDown, ImagePlus, ArrowRight, Plus, Check } from 'lucide-react';
import { objectives, saveDraftIntent, type Objective } from '@/lib/draft-intent';
import { ErrorMessage } from './ui';

const starters: { label: string; idea: string; objective: Objective }[] = [
  { label: 'A product reveal', idea: 'A close-up product reveal. Start with the details, then show the product in use.', objective: 'Product launch' },
  { label: 'A new collection', idea: 'Introduce our new collection with bold details, natural movement and a clean final product shot.', objective: 'Brand awareness' },
  { label: 'An offer worth noticing', idea: 'Lead with the product benefit, show it in action and finish with our seasonal offer.', objective: 'Offer promotion' },
];

export function IdeaComposer() {
  const id = useId(), router = useRouter(), input = useRef<HTMLTextAreaElement>(null), submitting = useRef(false);
  const [idea, setIdea] = useState(''), [objective, setObjective] = useState<Objective>('Product launch');
  const [details, setDetails] = useState(false), [brand, setBrand] = useState(''), [product, setProduct] = useState(''), [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true);
    const direction = idea.trim().slice(0, 2000);
    if (!saveDraftIntent({ name: direction.split(/[\n.!?]/)[0].slice(0, 80) || 'Untitled ad project', objective, brand: brand.trim(), product: product.trim(), direction })) {
      setError('Your browser could not keep this draft. Enable site storage and try again.'); setBusy(false); submitting.current = false; return;
    }
    router.push('/projects?new=1');
  }
  return <div className="idea-composer-wrap">
    <form className="idea-composer" onSubmit={submit} aria-labelledby={id + '-label'} aria-busy={busy}>
      <span className="border-beam" aria-hidden="true"/>
      <label id={id + '-label'} htmlFor={id + '-idea'}>Describe your ad</label>
      <textarea id={id + '-idea'} name="direction" ref={input} rows={3} maxLength={2000} value={idea} onChange={e => setIdea(e.target.value)} placeholder="What’s the idea? A product reveal, a different cast, a fresh take on a reference…" aria-describedby={id + '-help'}/>
      <div className="idea-details" id={id + '-details'} hidden={!details}>
        <div><label htmlFor={id + '-brand'}>Brand name</label><input id={id + '-brand'} name="brand" maxLength={100} value={brand} onChange={e => setBrand(e.target.value)} autoComplete="organization"/></div>
        <div><label htmlFor={id + '-product'}>Product</label><input id={id + '-product'} name="product" maxLength={200} value={product} onChange={e => setProduct(e.target.value)}/></div>
      </div>
      <div className="idea-toolbar">
        <div className="idea-tools"><button type="button" className="idea-product" aria-label="Add product details" aria-expanded={details} aria-controls={id + '-details'} onClick={() => setDetails(!details)}><Plus size={16}/>Product</button>
          <div className="idea-goal"><label className="sr-only" htmlFor={id + '-goal'}>Ad goal</label><select id={id + '-goal'} name="objective" value={objective} onChange={e => setObjective(e.target.value as Objective)}>{objectives.map((o,index) => <option key={o} value={o}>{['Launch','Awareness','Offer','Explain'][index]}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></div>
        </div>
        <button className="idea-submit shimmer" type="submit" disabled={busy}>{busy ? 'Opening…' : 'Continue'}<ArrowUpRight size={18}/></button>
      </div>
      <ErrorMessage message={error}/>
    </form>
    <p id={id + '-help'} className="idea-help"><ImagePlus size={14}/>Add your reference video and product photos in the studio.</p>
    <ul className="idea-chips" aria-label="What you get">{['Free to draft', 'No card needed', 'Quote before generation'].map(c => <li key={c}><Check size={11} strokeWidth={3} aria-hidden="true"/>{c}</li>)}</ul>
    <div className="idea-starters" role="group" aria-label="Ideas to start with"><span>Try an idea</span>{starters.map(s => <button type="button" key={s.label} onClick={() => { setIdea(s.idea); setObjective(s.objective); input.current?.focus(); }}>{s.label}<ArrowRight size={13}/></button>)}</div>
  </div>;
}
