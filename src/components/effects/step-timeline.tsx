'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, ScanLine, Layers3, Film, Check, FileVideo, Flag } from 'lucide-react';
import { useInView, useReducedMotion } from './use-motion';
import { PixelDinosaur, FinishFlag } from './pixel-dinosaur';

/** Status reflects what works today: drafting and storyboards are live; video generation opens with live services. */
const steps = [
  { Icon: ScanLine, short: 'Reference', title: 'Bring the spark', body: 'Upload an authorized reference. Identify the hook, pacing and shots worth exploring.', status: 'Available now', live: true },
  { Icon: Layers3, short: 'Direction', title: 'Make it unmistakably yours', body: 'Add your product, brand and brief. Choose characters when needed, then shape each scene.', status: 'Available now', live: true },
  { Icon: Film, short: 'Review & produce', title: 'Approve, then produce', body: 'Approve every storyboard frame and the credit quote. Then produce the video, scene by scene.', status: 'Video opens with live services', live: false },
];
/** Small drawn slices of the real studio inside each card (after MakeUGC's step mockups). */
function Mock({ step }: { step: number }) {
  if (step === 0) return <div className="mini" aria-hidden="true"><div className="mini-file"><FileVideo size={16}/><span><b>reference.mp4</b><small>12 s · MP4 · checked</small></span><Check size={14} className="mini-ok"/></div></div>;
  if (step === 1) return <div className="mini" aria-hidden="true"><div className="mini-row"><small>Product</small><b>Daily serum, 30 ml</b></div><div className="mini-row"><small>Goal</small><span className="mini-chip">Launch</span></div><div className="mini-row"><small>Direction</small><b>Warmer palette, new cast</b></div></div>;
  return <div className="mini" aria-hidden="true"><div className="mini-row"><small>3 frames × 5</small><b>15 credits</b></div><div className="mini-row"><small>Video</small><b>Quoted after frames</b></div><span className="mini-approve">Approve quote</span></div>;
}
const STEP_MS = 4000, TOTAL = STEP_MS * steps.length;
const clock = (ms: number) => `00:${String(Math.floor(ms / 1000)).padStart(2, '0')}`;

/** A play-through of the three steps: a scrubber walks across, the matching card lights up. */
export function StepTimeline() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const visible = useInView(root, '0px');
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const active = Math.min(steps.length - 1, Math.floor(elapsed / STEP_MS));

  useEffect(() => {
    if (reduce) setPlaying(false);
  }, [reduce]);
  useEffect(() => {
    const sync = () => setPageVisible(!document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  useEffect(() => {
    if (!playing || !visible || !pageVisible) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      setElapsed(e => (e + delta) % TOTAL);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, pageVisible]);

  const pct = (elapsed / TOTAL) * 100;
  return <div ref={root} className="step-timeline dino-timeline" data-running={playing && visible && pageVisible}>
    <p className="timeline-demo-label">A quick walk through the studio <span>Illustrative walkthrough · Not job progress</span></p>
    <div className="timeline-bar">
      <button type="button" className="timeline-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause the walkthrough' : 'Play the walkthrough'}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
      <div className="timeline-track">
        <span className="timeline-fill" style={{ transform: `scaleX(${pct / 100})` }}/>
        <span className="timeline-rider" style={{ transform: `translateX(${pct}%)` }} aria-hidden="true"><PixelDinosaur/></span>
        {steps.map((s, i) => <button type="button" key={s.short} className={'timeline-mark' + (i <= active ? ' is-past' : '')} style={{ insetInlineStart: (i / steps.length) * 100 + '%' }}
          aria-label={`Show step ${i + 1}: ${s.short}`} aria-pressed={i === active} onClick={() => { setElapsed(i * STEP_MS + 1); setPlaying(false); }}><span>0{i + 1}</span><Flag size={17} aria-hidden="true"/></button>)}
        <span className="timeline-finish" aria-hidden="true"><FinishFlag/></span>
      </div>
      <span className="timeline-clock" aria-hidden="true">{clock(elapsed)} / {clock(TOTAL)}</span>
    </div>
    <ol className="step-cards">{steps.map(({ Icon, title, body, status, live }, i) => <li key={title} className={i === active ? 'is-active' : ''}><span className="step-no">0{i + 1}</span><Icon size={22} strokeWidth={1.5} aria-hidden="true"/><h3>{title}</h3><p>{body}</p><Mock step={i}/><span className={'status-pill' + (live ? '' : ' is-planned')}>{status}</span></li>)}</ol>
  </div>;
}
