'use client';

// Adapted from Magic UI's Border Beam (MIT). See licenses/magic-ui.txt.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useInView, useReducedMotion } from '../effects/use-motion';

export function BorderBeam({ duration = 9 }: { duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, '0px');
  const reduced = useReducedMotion();
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(!document.hidden);
    sync(); document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return <span ref={ref} className="ui-border-beam" aria-hidden="true">
    <motion.span className="ui-border-beam-light"
      initial={{ offsetDistance: '0%' }}
      animate={{ offsetDistance: !reduced && visible && active ? ['0%', '100%'] : '0%' }}
      transition={{ repeat: !reduced && visible && active ? Infinity : 0, ease: 'linear', duration: !reduced && visible && active ? duration : 0 }}/>
  </span>;
}
