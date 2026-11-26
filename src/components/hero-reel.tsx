/**
 * The hero's product view: a storyboard reel of one illustrative ad, drawn entirely in CSS.
 * A generic amber bottle stands in for "your product" so nothing pretends to be a real brand or a generated frame.
 * The reel drifts sideways (CSS only), pauses on hover, and stands still for reduced motion.
 */
type Frame = { scene: string; beat: string; secs: number; tone: string; shot: string; approved: boolean };

const frames: Frame[] = [
  { scene: '01', beat: 'Hook', secs: 2, tone: 'peach', shot: 'close', approved: true },
  { scene: '02', beat: 'Detail', secs: 3, tone: 'butter', shot: 'light', approved: true },
  { scene: '03', beat: 'In context', secs: 3, tone: 'sage', shot: 'shelf', approved: true },
  { scene: '04', beat: 'Product moment', secs: 3, tone: 'lavender', shot: 'orbit', approved: false },
  { scene: '05', beat: 'Invitation', secs: 3, tone: 'cream', shot: 'end', approved: false },
];

function Shot({ shot }: { shot: string }) {
  return <div className={'reel-shot shot-' + shot}>
    {shot === 'light' && <span className="reel-sun"/>}
    {shot === 'shelf' && <><span className="reel-leaf"/><span className="reel-shelf"/></>}
    {shot === 'orbit' && <span className="reel-orbit"/>}
    <span className="reel-bottle"><span className="reel-label"/></span>
    {shot === 'end' && <span className="reel-endcard"><span>Your logo</span><i/></span>}
  </div>;
}

function Strip({ copy }: { copy?: boolean }) {
  return <ol className="reel-strip" aria-hidden={copy || undefined}>{frames.map(f => <li key={f.scene} className={'reel-frame tone-' + f.tone}>
    <div className="reel-film"><Shot shot={f.shot}/><span className="reel-slate">{f.scene}</span></div>
    <div className="reel-meta"><span>{f.beat}</span><span className={'reel-state' + (f.approved ? ' is-approved' : '')}>{f.secs}s</span></div>
  </li>)}</ol>;
}

export function HeroReel() {
  return <figure className="hero-reel">
    <div className="reel-window" role="img" aria-label="Illustrated storyboard of a 14-second vertical ad in five scenes: hook, detail, in context, product moment and invitation. The first three scenes are approved.">
      <div className="reel-track"><Strip/><Strip copy/></div>
    </div>
    <figcaption>Illustrated storyboard · 9:16 · 14 s. Your frames are made from your own product photos once you approve a quote.</figcaption>
  </figure>;
}
