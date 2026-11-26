'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, ScanLine, Layers3, Film, Clapperboard } from 'lucide-react';
import { useInView, useReducedMotion } from './use-motion';

/** Status reflects what works today: drafting and storyboards are live; video generation opens with live services. */
const steps = [
  { Icon: ScanLine, short: 'Reference', title: 'Bring the spark', body: 'Upload an authorized reference. Identify the hook, pacing and shots worth exploring.', status: 'Available now', live: true },
  { Icon: Layers3, short: 'Direction', title: 'Make it unmistakably yours', body: 'Add your product, brand and brief. Choose characters when needed, then shape each scene.', status: 'Available now', live: true },
  { Icon: Film, short: 'Review & produce', title: 'Approve, then produce', body: 'Approve every storyboard frame and the credit quote. Then produce the video, scene by scene.', status: 'Video opens with live services', live: false },
];
const STEP_MS = 4000, TOTAL = STEP_MS * steps.length;
const clock = (ms: number) => `00:${String(Math.floor(ms / 1000)).padStart(2, '0')}`;

/** A play-through of the three steps: a scrubber walks across, the matching card lights up. */
export function StepTimeline() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const visible = useInView(root, '0px');
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const active = Math.min(steps.length - 1, Math.floor(elapsed / STEP_MS));

  useEffect(() => {
    if (reduce) setPlaying(false);
  }, [reduce]);
  useEffect(() => {
    if (!playing || !visible) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      setElapsed(e => (e + (now - last)) % TOTAL);
      last = now; raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible]);

  const pct = (elapsed / TOTAL) * 100;
  return <div ref={root} className="step-timeline">
    <div className="timeline-bar">
      <button type="button" className="timeline-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause the walkthrough' : 'Play the walkthrough'}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
      <div className="timeline-track">
        <span className="timeline-fill" style={{ inlineSize: pct + '%' }}/>
        <span className="timeline-rider" style={{ insetInlineStart: pct + '%' }} aria-hidden="true"><Clapperboard size={16} strokeWidth={1.75}/></span>
        {steps.map((s, i) => <button type="button" key={s.short} className={'timeline-mark' + (i <= active ? ' is-past' : '')} style={{ insetInlineStart: (i / steps.length) * 100 + '%' }}
          aria-label={`Show step ${i + 1}: ${s.short}`} aria-pressed={i === active} onClick={() => { setElapsed(i * STEP_MS + 1); setPlaying(false); }}><span>0{i + 1}</span></button>)}
      </div>
      <span className="timeline-clock" aria-hidden="true">{clock(elapsed)} / {clock(TOTAL)}</span>
    </div>
    <ol className="step-cards">{steps.map(({ Icon, title, body, status, live }, i) => <li key={title} className={i === active ? 'is-active' : ''}><span className="step-no">0{i + 1}</span><Icon size={22} strokeWidth={1.5} aria-hidden="true"/><h3>{title}</h3><p>{body}</p><span className={'status-pill' + (live ? '' : ' is-planned')}>{status}</span></li>)}</ol>
  </div>;
}
