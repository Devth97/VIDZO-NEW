'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, Sparkles } from 'lucide-react';

export function Modal({ open, close, title, children }: { open: boolean; close: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); else if (!open && ref.current?.open) ref.current.close(); }, [open]);
  return <dialog ref={ref} className="modal" onCancel={close} onClose={close} aria-label={title}>
    <div className="section-head"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={20}/></button></div>{children}
  </dialog>;
}
export function Wordmark() { return <span className="wordmark"><span className="brand-symbol"><Sparkles size={18}/></span>vidzo<span className="wordmark-dot">.</span></span>; }
export function ProductArt({ variant = 0, small = false }: { variant?: number; small?: boolean }) {
  return <div className={`product-art art-${variant % 4} ${small ? 'small' : ''}`} role="img" aria-label="Illustrative product composition, not a generated ad">
    <div className="art-orbit"/><div className="art-pedestal"/><div className="bottle"><div className="bottle-cap"/><div className="bottle-body"><span className="bottle-label">forma<span>DAILY RITUAL</span><i>01</i></span></div></div>
    <span className="art-type">a little<br/><em>everyday magic.</em></span><span className="art-caption">ORIGINAL CONCEPT · ILLUSTRATION</span>
  </div>;
}
export function ErrorMessage({ message }: { message: string }) { return message ? <p role="alert" className="error-message">{message}</p> : null; }
export function Loading() { return <div className="loading-state" role="status"><Sparkles size={24}/><p>Opening your studio…</p></div>; }
