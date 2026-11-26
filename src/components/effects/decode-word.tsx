'use client';
import { useEffect, useState } from 'react';
import { useReducedMotion } from './use-motion';

const glyphs = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Cycles through words with a short letter-scramble between them.
 * Screen readers get the first word only; the animated copy is hidden from them.
 */
export function DecodeWord({ words, hold = 2600 }: { words: string[]; hold?: number }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(words[0]);

  useEffect(() => {
    if (reduce || words.length < 2) { setShown(words[0]); return; }
    let frame = 0, raf = 0;
    const timer = setInterval(() => {
      const next = (index + 1) % words.length, target = words[next], from = words[index];
      const steps = 16, len = Math.max(target.length, from.length);
      frame = 0;
      const tick = () => {
        frame++;
        const settled = Math.floor((frame / steps) * target.length);
        let out = '';
        for (let i = 0; i < Math.min(len, Math.max(target.length, from.length - Math.floor(frame / 2))); i++)
          out += i < settled ? target[i] : glyphs[Math.floor(Math.random() * glyphs.length)];
        setShown(out);
        if (frame < steps) raf = window.setTimeout(tick, 32) as unknown as number;
        else { setShown(target); setIndex(next); }
      };
      tick();
    }, hold);
    return () => { clearInterval(timer); clearTimeout(raf); };
  }, [index, reduce, words, hold]);

  return <><span className="sr-only">{words[0]}</span><span className="decode-word" aria-hidden="true">{shown}</span></>;
}
