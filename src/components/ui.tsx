'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, Sparkles, Aperture, Film } from 'lucide-react';

export function Modal({ open, close, title, children }: { open: boolean; close: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { d.showModal(); d.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), textarea, select')?.focus({ preventScroll: true }); }
    else if (!open && d.open) d.close();
  }, [open]);
  return <dialog ref={ref} className="modal" onCancel={close} onClose={close} aria-label={title}>
    <div className="section-head"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={20}/></button></div>{children}
  </dialog>;
}
export function Wordmark() { return <span className="wordmark"><span className="brand-symbol"><Aperture size={22} strokeWidth={1.5}/></span>vidzo<span className="wordmark-dot">.</span></span>; }
export function MediaPlaceholder({ small = false, label = 'No preview yet' }: { small?: boolean; label?: string }) {
  return <div className={'media-placeholder' + (small ? ' small' : '')}><Film size={small ? 24 : 32} strokeWidth={1.25} aria-hidden="true"/>{label && <span>{label}</span>}</div>;
}
export function ErrorMessage({ message }: { message: string }) { return message ? <p role="alert" className="error-message">{message}</p> : null; }
export function Loading() { return <div className="loading-state" role="status"><Sparkles size={24}/><p>Opening your studio…</p></div>; }
