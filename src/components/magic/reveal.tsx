'use client';
import { motion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/** Blur-fade on scroll (Magic UI "BlurFade" pattern). Respects the visitor's reduced-motion setting. */
export function Reveal({ children, delay = 0, className, y = 18 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return <MotionConfig reducedMotion="user">
    <motion.div className={className} initial={{ opacity: 0, y, filter: 'blur(8px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }} transition={{ duration: .6, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>
  </MotionConfig>;
}
