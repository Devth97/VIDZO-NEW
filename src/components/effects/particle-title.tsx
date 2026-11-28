'use client';
import { useEffect, useRef } from 'react';
import { useInView, useReducedMotion } from './use-motion';

type Dot = { x: number; y: number; tx: number; ty: number; vx: number; vy: number; lime: boolean; phase: number };

/**
 * Draws a line of text out of small dots that gather into place and drift gently.
 * The pointer pushes dots aside. Decorative only: the same words exist as real text nearby.
 */
export function ParticleTitle({ text }: { text: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const visible = useInView(canvas);
  const dots = useRef<Dot[]>([]);
  const pointer = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let cancelled = false, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const build = () => {
      const w = c.clientWidth, h = c.clientHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const o = off.getContext('2d')!;
      const family = getComputedStyle(c).fontFamily || 'sans-serif';
      let size = h * .78;
      o.font = `600 ${size}px ${family}`;
      const fit = o.measureText(text).width;
      if (fit > w * .96) size *= (w * .96) / fit;
      o.font = `600 ${size}px ${family}`;
      o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#000';
      o.fillText(text, w / 2, h / 2);
      const data = o.getImageData(0, 0, w, h).data;
      const gap = w < 500 ? 2 : 4;
      const next: Dot[] = [];
      for (let y = 0; y < h; y += gap) for (let x = 0; x < w; x += gap) {
        if (data[(y * w + x) * 4 + 3] > 128) {
          const tx = x, ty = y;
          next.push({ tx, ty, x: reduce ? tx : Math.random() * w, y: reduce ? ty : Math.random() * h, vx: 0, vy: 0, lime: Math.random() < .14, phase: Math.random() * 6.28 });
        }
      }
      dots.current = next;
    };

    const paint = (time: number) => {
      const w = c.clientWidth, h = c.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const { x: px, y: py } = pointer.current;
      for (const d of dots.current) {
        if (!reduce) {
          let ax = (d.tx + Math.sin(time / 900 + d.phase) * .8 - d.x) * .06, ay = (d.ty + Math.cos(time / 1100 + d.phase) * .8 - d.y) * .06;
          const dx = d.x - px, dy = d.y - py, dist = dx * dx + dy * dy;
          if (dist < 3600) { const f = (3600 - dist) / 3600 * 2.4; const len = Math.sqrt(dist) || 1; ax += dx / len * f; ay += dy / len * f; }
          d.vx = (d.vx + ax) * .82; d.vy = (d.vy + ay) * .82; d.x += d.vx; d.y += d.vy;
        }
        ctx.fillStyle = d.lime ? '#9cc22a' : '#3e5035';
        ctx.fillRect(d.x - .9, d.y - .9, 1.8, 1.8);
      }
      c.dataset.ready = 'true';
    };

    document.fonts?.ready.then(() => {
      if (cancelled) return;
      build();
      if (reduce || !visible) { paint(0); return; }
      const loop = (t: number) => { paint(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    });
    const onResize = () => { build(); paint(0); };
    window.addEventListener('resize', onResize);
    return () => { cancelled = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [text, reduce, visible]);

  return <canvas ref={canvas} className="particle-title" aria-hidden="true"
    onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top }; }}
    onPointerLeave={() => { pointer.current = { x: -999, y: -999 }; }}/>;
}
