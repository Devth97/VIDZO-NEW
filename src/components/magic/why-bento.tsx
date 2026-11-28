'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, Lock, ShieldCheck, ImageIcon, Undo2 } from 'lucide-react';
import { SpotlightCard } from './spotlight-card';
import { NumberTicker } from './number-ticker';
import { Shot } from '../hero-reel';

/**
 * A bento grid of what the studio guarantees (Magic UI "BentoGrid" + 21st.dev feature-grid patterns).
 * Every tile shows a real behaviour of the product, animated, with no invented numbers.
 */
function ApprovalTicks() {
  return <div className="flex gap-2" aria-hidden="true">{[0, 1, 2].map(i => <div key={i} className="relative aspect-[9/16] w-14 overflow-hidden rounded-lg border border-line bg-lavender">
    <Shot shot={['close', 'shelf', 'orbit'][i]}/>
    <motion.span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-olive text-white" initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }} transition={{ delay: .4 + i * .35, type: 'spring', stiffness: 320, damping: 18 }}><Check size={12} strokeWidth={3}/></motion.span>
  </div>)}</div>;
}

function SceneSwap() {
  const [v, setV] = useState(1);
  const reduce = useReducedMotion();
  useEffect(() => { if (reduce) return; const t = setInterval(() => setV(x => (x === 1 ? 2 : 1)), 2200); return () => clearInterval(t); }, [reduce]);
  return <div className="flex gap-2" aria-hidden="true">{['01', '02', '03', '04'].map(s => <div key={s} className="flex h-16 w-14 flex-col items-center justify-center rounded-lg border border-line bg-paper font-mono text-[11px]">
    <span>{s}</span>
    {s === '03' ? <AnimatePresence mode="popLayout" initial={false}><motion.span key={v} className="rounded-full bg-lime px-1.5 outline outline-1 outline-ink" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>v{v}</motion.span></AnimatePresence> : <span className="text-muted">v1</span>}
  </div>)}</div>;
}

export function WhyBento() {
  return <MotionConfig reducedMotion="user"><div className="bento">
    <SpotlightCard className="bento-wide">
      <div className="flex items-center gap-4" aria-hidden="true">
        <div className="relative aspect-[9/16] w-20 rounded-xl border border-dashed border-[#a59c80] bg-[repeating-linear-gradient(135deg,#f6efdc_0_8px,#fffdf6_8px_9px)]"><span className="absolute left-1.5 top-1.5 rounded-full bg-paper px-1.5 font-mono text-[11px]">ref</span></div>
        <motion.span animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}><ArrowRight/></motion.span>
        <div className="relative aspect-[9/16] w-20 overflow-hidden rounded-xl border-[1.5px] border-ink bg-peach shadow-[3px_4px_0_#e4dcc4]"><Shot shot="light"/><span className="absolute left-1.5 top-1.5 rounded-full bg-paper px-1.5 font-mono text-[11px]">yours</span></div>
      </div>
      <h3>Reference in, original out</h3><p>We study the concept of an authorized reference: the hook, pacing and shots. Then you build a new ad with your product, your cast and your words.</p>
    </SpotlightCard>
    <SpotlightCard><ApprovalTicks/><h3>Approve frame by frame</h3><p>Nothing moves to video until every storyboard frame has your approval.</p></SpotlightCard>
    <SpotlightCard>
      <p className="m-0 font-mono text-[11px] text-muted" aria-hidden="true">3 frames × 5 credits</p>
      <p className="m-0 text-5xl font-medium tracking-tight"><NumberTicker value={15}/><span className="ml-2 text-sm text-muted">credits</span></p>
      <h3>A quote before you spend</h3><p>See the model, resolution and maximum credits, then confirm. Technical failures release unsettled credits.</p>
    </SpotlightCard>
    <SpotlightCard><SceneSwap/><h3><Undo2 size={18} className="mr-1.5 inline align-[-3px]"/>Redo one scene</h3><p>Change a scene and only that scene is redone. The rest keep their approved work.</p></SpotlightCard>
    <SpotlightCard>
      <ul className="m-0 grid list-none gap-2 p-0 text-sm">
        {[[Lock, 'Private storage, no public gallery'], [ImageIcon, 'Your product photos and logo stay exact'], [ShieldCheck, 'You review likeness and claims']].map(([Icon, t]) => {
          const I = Icon as typeof Lock;
          return <li key={t as string} className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2"><I size={16} className="shrink-0 text-olive"/>{t as string}</li>;
        })}
      </ul>
      <h3>Private by default</h3><p>Your references, products and drafts live in your private workspace.</p>
    </SpotlightCard>
  </div></MotionConfig>;
}
