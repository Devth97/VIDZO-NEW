'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import { ArrowRight, Film, Rocket, Megaphone, Tag, Lightbulb, ChevronDown, UploadCloud, ImagePlus, ListChecks } from 'lucide-react';
import { objectives, saveDraftIntent, type DraftIntent, type Objective } from '@/lib/draft-intent';
import { ErrorMessage } from './ui';

const goalLabels: Record<Objective, { short: string; Icon: typeof Rocket }> = {
  'Product launch': { short: 'Launch', Icon: Rocket },
  'Brand awareness': { short: 'Awareness', Icon: Megaphone },
  'Offer promotion': { short: 'Offer', Icon: Tag },
  'Product education': { short: 'Explain', Icon: Lightbulb },
};

/** Quick starts fill real fields. They are starting points for a draft, not prompts sent to a model. */
export const quickStarts: { label: string; name: string; objective: Objective }[] = [
  { label: 'Product reveal', name: 'Product reveal', objective: 'Product launch' },
  { label: 'New collection', name: 'New collection drop', objective: 'Brand awareness' },
  { label: 'Seasonal offer', name: 'Seasonal offer', objective: 'Offer promotion' },
  { label: 'How it works', name: 'How it works', objective: 'Product education' },
];

type Props = {
  /** hero: saves the intent and opens the workspace (sign-in if needed). workspace: creates the project directly. */
  variant: 'hero' | 'workspace';
  initial?: DraftIntent | null;
  onCreate?: (intent: DraftIntent) => Promise<void>;
  autoFocus?: boolean;
};

export function CreationComposer({ variant, initial, onCreate, autoFocus }: Props) {
  const router = useRouter();
  const id = useId();
  const nameRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [objective, setObjective] = useState<Objective>(initial?.objective ?? 'Product launch');
  const [brand, setBrand] = useState(initial?.brand ?? ''), [product, setProduct] = useState(initial?.product ?? '');
  const [details, setDetails] = useState(Boolean(initial?.brand || initial?.product));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false); // synchronous guard: state updates lag behind a fast double-click

  useEffect(() => {
    if (!initial) return;
    setName(initial.name); setObjective(initial.objective); setBrand(initial.brand); setProduct(initial.product);
    if (initial.brand || initial.product) setDetails(true);
  }, [initial]);
  useEffect(() => { if (autoFocus) nameRef.current?.focus(); }, [autoFocus]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    const intent: DraftIntent = { name: name.trim().slice(0, 100) || 'Untitled ad project', objective, brand: brand.trim().slice(0, 100), product: product.trim().slice(0, 200) };
    try {
      if (variant === 'workspace' && onCreate) { await onCreate(intent); return; }
      saveDraftIntent(intent); // if storage is unavailable the workspace still offers a blank draft
      router.push('/projects?new=1');
    } catch (e) { setError((e as Error).message); setBusy(false); submitting.current = false; }
  }

  return <div className={'composer-wrap composer-wrap-' + variant}><form className={'composer composer-' + variant} onSubmit={submit} aria-labelledby={id + '-title'}>
    <div className="composer-head"><span id={id + '-title'}><Film size={14}/>NEW AD DRAFT</span><span className="composer-format">9:16 · 10–15 SECONDS</span></div>
    <label className="sr-only" htmlFor={id + '-name'}>Project name</label>
    <textarea ref={nameRef} id={id + '-name'} className="composer-input" rows={2} maxLength={100} value={name} onChange={e => setName(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
      placeholder="Name your ad — e.g. Summer serum launch" aria-describedby={id + '-help'}/>
    <div className="composer-controls">
      <div className="composer-goal"><span className="composer-label" id={id + '-goal'}>Goal</span>
        <SegmentedControl label="Ad goal" value={objective} onChange={v => setObjective(v as Objective)} size="sm">
          {objectives.map(o => <SegmentedControlItem key={o} value={o} label={goalLabels[o].short}/>)}
        </SegmentedControl>
      </div>
      <button type="button" className="composer-toggle" aria-expanded={details} aria-controls={id + '-details'} onClick={() => setDetails(!details)}>Brand &amp; product<span className="muted"> · optional</span><ChevronDown size={15} className={details ? 'is-open' : ''}/></button>
    </div>
    <div id={id + '-details'} className="composer-details" hidden={!details}>
      <div><label htmlFor={id + '-brand'}>Brand name</label><input id={id + '-brand'} maxLength={100} value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Acme Botanicals" autoComplete="organization"/></div>
      <div><label htmlFor={id + '-product'}>Primary product</label><input id={id + '-product'} maxLength={200} value={product} onChange={e => setProduct(e.target.value)} placeholder="e.g. Daily serum, 30 ml"/></div>
    </div>
    <ErrorMessage message={error}/>
    <div className="composer-foot">
      <ol className="composer-next" id={id + '-help'} aria-label="What happens next in your private studio">
        <li><UploadCloud size={14}/>Reference video</li><li><ImagePlus size={14}/>Product photos</li><li><ListChecks size={14}/>Approve, then quote</li>
      </ol>
      <button type="submit" className="button primary composer-submit" disabled={busy}>{busy ? (variant === 'workspace' ? 'Creating draft…' : 'Opening studio…') : variant === 'workspace' ? 'Create draft' : 'Start a free draft'}<ArrowRight size={16}/></button>
    </div>
  </form>
  <div className="quick-starts" role="group" aria-label="Quick starts: fill in a name and goal">
    <span className="quick-starts-label">Quick start</span>
    {quickStarts.map(q => { const { Icon } = goalLabels[q.objective]; const active = name === q.name && objective === q.objective; return <button type="button" key={q.label} aria-pressed={active} onClick={() => { setName(q.name); setObjective(q.objective); nameRef.current?.focus(); }}><Icon size={15}/>{q.label}</button>; })}
  </div></div>;
}
