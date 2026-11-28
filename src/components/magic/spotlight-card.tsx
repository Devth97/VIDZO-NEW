'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Pointer-follow smoothing adapted from React Bits SpotlightCard.
// MIT + Commons Clause; website use. See licenses/react-bits.txt.
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const state = { x: 0, y: 0, tx: 0, ty: 0 };
    let raf = 0, last = 0;
    function tick(now: number) {
      raf = 0;
      if (!element || document.hidden) return;
      const dt = Math.min(.05, Math.max(.001, (now - last) / 1000));
      last = now;
      const follow = media.matches ? 1 : 1 - Math.exp(-dt / (.015 + .3 * .22));
      state.x += (state.tx - state.x) * follow;
      state.y += (state.ty - state.y) * follow;
      element.style.setProperty('--mx', `${state.x.toFixed(1)}px`);
      element.style.setProperty('--my', `${state.y.toFixed(1)}px`);
      if (Math.abs(state.tx - state.x) > .1 || Math.abs(state.ty - state.y) > .1) raf = requestAnimationFrame(tick);
    }
    function move(event: PointerEvent) {
      if (!element || event.pointerType === 'touch') return;
      const box = element.getBoundingClientRect();
      state.tx = event.clientX - box.left; state.ty = event.clientY - box.top;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', stop);
    document.addEventListener('visibilitychange', stop);
    return () => { stop(); element.removeEventListener('pointermove', move); element.removeEventListener('pointerleave', stop); document.removeEventListener('visibilitychange', stop); };
  }, []);
  return <div ref={root} className={cn('spotlight-card', className)}>
    {children}
  </div>;
}
