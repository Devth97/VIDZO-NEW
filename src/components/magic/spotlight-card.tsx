'use client';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A card whose surface lights up under the pointer (Aceternity / 21st.dev "spotlight card" pattern), pure CSS variables. */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('spotlight-card', className)}
    onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`); }}>
    {children}
  </div>;
}
