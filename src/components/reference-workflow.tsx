'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check, Clapperboard, Download, Film, Link2, Pencil, Expand } from 'lucide-react';
import { saveDraftIntent } from '@/lib/draft-intent';
import { Modal } from './ui';
import { SilentVideo } from './silent-video';

const examples = [
  { id: 'cat-bed', product: 'Cat bed', direction: 'Before → after', time: 'Tuesday · 7:00 PM' },
  { id: 'poolside-bag', product: 'Plaid bag', direction: 'A playful product story', time: 'Wednesday · 12:30 PM' },
  { id: 'headphone-detail', product: 'Headphones', direction: 'Detail-led close-up', time: 'Thursday · 7:00 PM' },
];
const initialBrief = 'Develop three original product-ad concepts: a before-and-after story for a cat bed, a playful lifestyle scene for a plaid bag, and a detail-led reveal for headphones. Use the supplied clips as references for structure. Aim for 15-second vertical ads, with an original script and approved product claims.';

export function ReferenceWorkflow() {
  const router = useRouter();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [brief, setBrief] = useState(initialBrief);
  const [status, setStatus] = useState('');
  const [opening, setOpening] = useState(false);
  const [selected, setSelected] = useState<typeof examples[number] | null>(null);
  function openDraft() {
    if (!saveDraftIntent({ name: 'Three product directions', objective: 'Product launch', brand: '', product: 'Cat bed, plaid bag, headphones', direction: brief.trim() })) {
      setStatus('Your browser could not save the brief. Enable site storage and try again.');
      return;
    }
    setOpening(true);
    router.push('/projects?new=1');
  }
  function downloadPlan() {
    const text = ['VIDZO · Example publishing plan', 'Illustrative only. Nothing has been generated or scheduled.', '', ...examples.map(example => `${example.product}: ${example.time} (example) — ${example.direction}`), '', 'Before publishing: review the final video, approved claims, captions, destination and time zone.'].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'vidzo-example-publishing-plan.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Example plan downloaded. Nothing has been scheduled.');
  }
  return <section className="editorial-section workflow-section" id="reference-workflow" aria-labelledby={id + '-title'}>
    <div className="playful-head"><p className="eyebrow">From reference to direction</p><h2 id={id + '-title'}>One reference.<br/><em>Three fresh directions.</em></h2><p>Keep the idea, the brief and the next decision together. Explore this sample, then make the direction your own.</p></div>
    <div className="workflow-demo">
      <header className="workflow-demo-header"><div><span className="workflow-demo-icon"><Clapperboard size={19} aria-hidden="true" /></span><strong>A campaign for three products</strong></div><span className="workflow-demo-badge">Interactive demo</span></header>
      <div className="workflow-demo-columns">
        <div className="workflow-demo-brief">
          <div className="workflow-demo-message">
            {editing ? <><label htmlFor={id + '-brief'}>Edit the sample brief</label><textarea id={id + '-brief'} value={brief} onChange={event => setBrief(event.target.value)} maxLength={2000} rows={6} /><button className="workflow-demo-text-button" onClick={() => setEditing(false)}>Save brief <Check size={14} /></button></> : brief === initialBrief ? <p>Make an original campaign for <span>@Cat bed</span> <span>@Plaid bag</span> <span>@Headphones</span> — three directions, one clear brief.</p> : <p>{brief || 'Add your creative direction to start a draft.'}</p>}
            <div className="workflow-demo-reference"><img src="/media/references/bathroom-original.jpg" alt="Thumbnail of the supplied reference scene" width={34} height={52} loading="lazy" /><div><strong>Supplied reference video</strong><span><Link2 size={12} aria-hidden="true" />Structure to study, expression to make your own</span></div></div>
          </div>
          <div className="workflow-demo-step"><Check size={17} aria-hidden="true" /><h3>A structure to build on</h3></div>
          <dl className="workflow-demo-breakdown"><div><dt>Hook</dt><dd>Give the viewer a reason to stop</dd></div><div><dt>Proof</dt><dd>Show the product and its benefit in context</dd></div><div><dt>CTA</dt><dd>Finish with one clear next step</dd></div></dl>
          <div className="workflow-demo-step"><Check size={17} aria-hidden="true" /><p>One distinct concept for each product</p></div>
          <div className="workflow-demo-step"><Check size={17} aria-hidden="true" /><p>Your review before production</p></div>
          <div className="workflow-demo-approval"><div className="workflow-demo-panel-heading"><h3>Ready to make it your own?</h3><span>Draft first</span></div><ul aria-label="Example brief settings"><li>3 concepts</li><li>9:16</li><li>15s target</li><li>Quote before generation</li></ul><div className="workflow-demo-actions"><button className="button ink" onClick={openDraft} disabled={!brief.trim() || opening}>{opening ? 'Opening…' : 'Open this brief'}<ArrowUpRight size={15} aria-hidden="true" /></button><button className="workflow-demo-edit" onClick={() => setEditing(!editing)} aria-expanded={editing}><Pencil size={14} aria-hidden="true" />{editing ? 'Done editing' : 'Edit brief'}</button></div><small>Creates a draft. Paid generation requires a separate quote and approval.</small></div>
        </div>
        <div className="workflow-demo-results">
          <div className="workflow-demo-results-heading"><span><Film size={15} aria-hidden="true" />Three reference directions</span><small>Silent autoplay</small></div>
          <div className="workflow-demo-videos">{examples.map(example => <figure key={example.id}><button className="workflow-demo-video-button" onClick={() => setSelected(example)} aria-label={`Watch ${example.product} reference`}><SilentVideo id={example.id} suspended={selected !== null} /><span><Expand size={15} aria-hidden="true" /></span></button><figcaption><strong>{example.product}</strong><span>{example.direction}</span></figcaption></figure>)}</div>
          <p className="workflow-demo-disclosure">Supplied clips · Silent references · Not VIDZO-generated results</p>
          <div className="workflow-demo-plan"><div className="workflow-demo-panel-heading"><h3>Plan the next step</h3><span>Example schedule</span></div><dl>{examples.map(example => <div key={example.id}><dt>{example.product}</dt><dd>{example.time}</dd></div>)}</dl><button className="workflow-demo-download" onClick={downloadPlan}><Download size={15} aria-hidden="true" />Download example plan</button><small>Planning preview. Social publishing is not connected.</small></div>
        </div>
      </div>
      <p className="workflow-demo-status" role="status">{status}</p>
    </div>
    <Modal open={selected !== null} close={() => setSelected(null)} title={selected ? `${selected.product} reference` : 'Video reference'}>{selected && <div className="video-showcase-player"><SilentVideo key={selected.id} id={selected.id} label={`${selected.product} supplied reference`} /><p>{selected.direction}</p><small>Supplied reference · Silent preview · Not a VIDZO output</small></div>}</Modal>
  </section>;
}
