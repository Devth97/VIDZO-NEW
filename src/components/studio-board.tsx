import Link from 'next/link';
import { Check, ArrowUpRight, Lock } from 'lucide-react';

/**
 * A drawn preview of the studio, adapted from the old site's "workflow board".
 * It shows the explore-mode sample project. Nothing here is a generated result, and the label says so.
 */
const rail = ['Reference', 'Analysis', 'Characters', 'Brand & brief', 'Storyboard', 'Generate', 'Export'];
const scenes = [
  { title: 'The hook', note: 'Close-up of the product, soft directional light', tone: 'peach', approved: true },
  { title: 'The product moment', note: 'Product in context, slow orbit over the details', tone: 'sage', approved: true },
  { title: 'The invitation', note: 'Hero composition with space for the logo', tone: 'lavender', approved: false },
] as const;

export function StudioBoard() {
  return <section className="editorial-section board-section" aria-labelledby="board-title">
    <div className="playful-head"><p className="eyebrow">Inside the studio</p><h2 id="board-title">Every scene in view.<br/><em>Every cost up front.</em></h2><p>One project holds the reference, the brief, each storyboard frame and the quote. Approve scenes one at a time and change a scene without redoing the rest.</p></div>
    <div className="studio-board" role="img" aria-label="Illustration of the studio: a seven-step rail, a three-scene storyboard with two scenes approved, and a credit quote waiting for approval">
      <ol className="board-rail" aria-hidden="true">{rail.map((r, i) => <li key={r} className={i < 4 ? 'is-done' : i === 4 ? 'is-current' : ''}><span>{i < 4 ? <Check size={12} strokeWidth={3}/> : i + 1}</span>{r}</li>)}</ol>
      <div className="board-scenes" aria-hidden="true">
        <div className="board-top"><strong>The everyday ritual</strong><span>Sample project</span></div>
        <div className="board-scene-grid">{scenes.map((s, i) => <article key={s.title} className={'board-scene tone-' + s.tone}>
          <div className="board-frame"><span>Scene 0{i + 1}</span><small>4s · v1</small></div>
          <h3>{s.title}</h3><p>{s.note}</p>
          <span className={'status-pill' + (s.approved ? '' : ' is-planned')}>{s.approved ? 'Frame approved' : 'Needs a frame'}</span>
        </article>)}</div>
      </div>
      <aside className="board-quote" aria-hidden="true">
        <span className="eyebrow">Quote</span>
        <p className="board-quote-figure">15<small> credits</small></p>
        <ul><li><span>Storyboard frames</span><span>3 × 5</span></li><li><span>Video</span><span>Quoted after frames</span></li><li><span>Held until you confirm</span><span>0</span></li></ul>
        <span className="board-approve"><Lock size={13}/>Approve quote</span>
      </aside>
    </div>
    <p className="board-caption">Illustration of the explore-mode sample. No generated frames or video are shown. <Link href="/projects?new=1">Start your own draft<ArrowUpRight size={13}/></Link></p>
  </section>;
}
