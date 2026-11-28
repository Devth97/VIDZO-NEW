'use client';
import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

/** Counts up to a real value when it scrolls into view (Magic UI "NumberTicker" pattern). Only ever shows true figures. */
export function NumberTicker({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { damping: 40, stiffness: 120 });
  useEffect(() => { if (inView && !reduce) mv.set(value); }, [inView, mv, value, reduce]);
  useEffect(() => {
    if (reduce) {
      if (ref.current) ref.current.textContent = value.toLocaleString('en-IN');
      return;
    }
    return spring.on('change', v => { if (ref.current) ref.current.textContent = Math.round(v).toLocaleString('en-IN'); });
  }, [spring, reduce, value]);
  // Keep the first server and client render identical; preferences apply after hydration.
  return <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{0}</span>;
}
