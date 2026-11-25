'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { Wordmark } from './ui';

export function PublicFrame({ children }: { children: ReactNode }) {
  const { mode, signedOut, ready, email } = useWorkspace();
  const [open, setOpen] = useState(false);
  const inStudio = mode === 'demo' || (ready && !signedOut && email);
  return <div className="public-frame">
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="public-header">
      <Link href="/" aria-label="Vidzo home"><Wordmark/></Link>
      <button className="icon-button public-menu" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="public-nav" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
      <nav id="public-nav" aria-label="Main" className={open ? 'is-open' : ''}>
        <Link href="/#how">How it works</Link><Link href="/showcase">Showcase</Link><Link href="/pricing">Pricing</Link><Link href="/#faq">FAQ</Link>
        {!inStudio && <Link href="/signin">Sign in</Link>}
        <Link className="button primary" href="/projects">{inStudio ? 'Open your studio' : 'Create your first ad'}</Link>
      </nav>
    </header>
    <main id="content" tabIndex={-1}>{children}</main>
    <footer className="public-footer"><span>© {new Date().getFullYear()} Vidzo · Beta. Brand and pricing are provisional.</span><div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/pricing#refunds">Refunds</Link><Link href="/support">Support</Link></div></footer>
  </div>;
}
