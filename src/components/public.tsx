'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { Wordmark } from './ui';

export function PublicFrame({ children }: { children: ReactNode }) {
  const { mode, signedOut, ready, email } = useWorkspace();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 8);
    sync(); window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, []);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); document.getElementById('public-menu-toggle')?.focus(); } };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const inStudio = mode === 'demo' || (ready && !signedOut && email);
  return <div className="public-frame">
    <a className="skip-link" href="#content">Skip to content</a>
    <div className={'public-header-bar' + (scrolled || open ? ' is-scrolled' : '')}><header className="public-header">
      <Link href="/" aria-label="Vidzo home"><Wordmark/></Link>
      <button id="public-menu-toggle" className="icon-button public-menu" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="public-nav" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
      <nav id="public-nav" aria-label="Main" className={open ? 'is-open' : ''} onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}>
        <Link href="/#how">The process</Link><Link href="/showcase" aria-current={pathname === '/showcase' ? 'page' : undefined}>Starting points</Link><Link href="/pricing" aria-current={pathname === '/pricing' ? 'page' : undefined}>Pricing</Link>
        {!inStudio && <Link href="/signin">Sign in</Link>}
        <Link className="button primary shimmer" href={inStudio ? '/projects' : '/projects?new=1'}>{inStudio ? 'Open your studio' : 'Start a free draft'}<ArrowUpRight size={16}/></Link>
      </nav>
    </header></div>
    <main id="content" tabIndex={-1}>{children}</main>
    <footer className="public-footer"><div className="footer-brand"><Link href="/" aria-label="Vidzo home"><Wordmark/></Link><p>Your product. Your perspective.</p><small>© {new Date().getFullYear()} VIDZO · Private beta</small></div><div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/pricing#refunds">Refunds</Link><Link href="/support">Support</Link></div></footer>
  </div>;
}
