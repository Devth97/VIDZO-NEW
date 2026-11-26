'use client';
import { useEffect, useState, type RefObject } from 'react';

/** True when the visitor asked the system for less motion. */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(q.matches);
    sync(); q.addEventListener('change', sync);
    return () => q.removeEventListener('change', sync);
  }, []);
  return reduce;
}

/** True while the element is on screen, so effects can stop drawing when nobody can see them. */
export function useInView(ref: RefObject<Element | null>, margin = '100px') {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return inView;
}
