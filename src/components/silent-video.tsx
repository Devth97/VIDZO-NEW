'use client';

import { useEffect, useRef } from 'react';

/** Shared silent loop: load and play visible references, release work offscreen. */
export function SilentVideo({ id, suspended = false, label }: { id: string; suspended?: boolean; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let visible = false;
    let disposed = false;
    const shouldPlay = () => !disposed && visible && !suspended && !motion.matches && !connection?.saveData && !document.hidden;
    const sync = () => {
      if (!shouldPlay()) { video.pause(); return; }
      video.muted = true;
      if (!video.getAttribute('src')) video.src = `/media/references/${id}.mp4`;
      void video.play().then(() => { if (!shouldPlay()) video.pause(); }).catch(() => {
        // Preserve the poster when a browser blocks autoplay.
      });
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.15 });
    observer.observe(video);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      disposed = true;
      observer.disconnect();
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      video.pause();
    };
  }, [id, suspended]);
  return <video ref={ref} width={360} height={640} poster={`/media/references/${id}.jpg`} autoPlay muted loop playsInline preload="none" disablePictureInPicture aria-label={label} aria-hidden={label ? undefined : true} />;
}
