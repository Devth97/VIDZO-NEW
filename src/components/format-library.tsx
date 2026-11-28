'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { saveDraftIntent } from '@/lib/draft-intent';
import { adFormats, formatDirection, type Format } from '@/lib/ad-formats';
import { Shot } from './hero-reel';

/**
 * Ad formats as starting structures, the way Arcads, Icon and MakeUGC lead with formats.
 * These are story structures, not results: picking one fills a draft brief you can rewrite.
 */
export { adFormats };

function Overlay({ kind }: { kind?: Format['overlay'] }) {
  if (kind === 'split') return <span className="fmt-split"><b>Before</b><b>After</b></span>;
  if (kind === 'list') return <span className="fmt-list"><b>1</b><b>2</b><b>3</b></span>;
  if (kind === 'box') return <span className="fmt-box"/>;
  if (kind === 'steps') return <span className="fmt-steps"><i/><i/><i/></span>;
  if (kind === 'offer') return <span className="fmt-offer">Your offer</span>;
  return null;
}

const tabs = [['all', 'All formats'], ['Product launch', 'Launch'], ['Brand awareness', 'Awareness'], ['Offer promotion', 'Offer'], ['Product education', 'Explain']] as const;

export function FormatLibrary() {
  const router = useRouter();
  const busy = useRef(false);
  const [tab, setTab] = useState<string>('all');
  function start(f: Format) {
    if (busy.current) return;
    busy.current = true;
    saveDraftIntent({ name: f.name, objective: f.objective, brand: '', product: '', direction: formatDirection(f) });
    router.push('/projects?new=1');
  }
  const shown = adFormats.filter(f => tab === 'all' || f.objective === tab);
  return <MotionConfig reducedMotion="user">
    <div className="format-tabs" role="group" aria-label="Filter formats by goal">{tabs.map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>
      {tab === value && <motion.span layoutId="format-tab" className="format-tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }}/>}<span className="relative">{label}</span>
    </button>)}</div>
    <motion.div layout className="format-grid"><AnimatePresence mode="popLayout" initial={false}>{shown.map(f => <motion.article layout key={f.name} className="format-card"
      initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} transition={{ duration: .25 }}>
      <div className={'format-thumb tone-' + f.tone} aria-hidden="true"><Shot shot={f.shot}/><Overlay kind={f.overlay}/><span className="reel-slate">9:16</span></div>
      <div className="format-body">
        <h3>{f.name}</h3><p>{f.job}</p>
        <ol className="format-beats">{f.beats.map((b, i) => <li key={b}><span>0{i + 1}</span>{b}</li>)}</ol>
        <button type="button" className="format-use" onClick={() => start(f)}>Use this format<ArrowRight size={14}/></button>
      </div>
    </motion.article>)}</AnimatePresence></motion.div>
  </MotionConfig>;
}
