'use client';
import { useEffect, useId, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/** A faint grid where a few cells softly light up and fade (Magic UI "AnimatedGridPattern" pattern). Decorative only. */
export function GridPattern({ size = 36, cells = 14, cols = 40, rows = 14 }: { size?: number; cells?: number; cols?: number; rows?: number }) {
  const id = useId();
  const reduce = useReducedMotion();
  const pick = () => Array.from({ length: cells }, () => [Math.floor(Math.random() * cols), Math.floor(Math.random() * rows)] as const);
  const [lit, setLit] = useState<(readonly [number, number])[]>([]);
  useEffect(() => {
    setLit(pick());
    if (reduce) return;
    const t = setInterval(() => setLit(pick()), 2400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  return <svg className="grid-pattern" aria-hidden="true">
    <defs><pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse"><path d={`M${size} 0H0V${size}`} fill="none" stroke="currentColor" strokeWidth="1"/></pattern></defs>
    <rect width="100%" height="100%" fill={`url(#${id})`}/>
    {lit.map(([x, y], i) => <rect key={`${x}-${y}-${i}`} className="grid-cell" x={x * size + 1} y={y * size + 1} width={size - 1} height={size - 1} style={{ animationDelay: `${(i % 7) * .25}s` }}/>)}
  </svg>;
}
