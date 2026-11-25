'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { FolderOpen, Image, Users, Wallet, LifeBuoy, Plus, Menu, X, ShieldCheck, Sparkles } from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { Wordmark } from './ui';

const items = [{ href: '/projects', label: 'Projects', Icon: FolderOpen }, { href: '/assets', label: 'Brand assets', Icon: Image }, { href: '/characters', label: 'Characters', Icon: Users }, { href: '/wallet', label: 'Wallet', Icon: Wallet }];
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(); const { wallet, demo, role, error } = useWorkspace(); const [menu, setMenu] = useState(false);
  return <div className="app-layout">
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="mobile-header"><Link href="/" aria-label="Vidzo home"><Wordmark/></Link><button className="icon-button" onClick={() => setMenu(!menu)} aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu}>{menu ? <X/> : <Menu/>}</button></header>
    <aside className={'sidebar ' + (menu ? 'is-open' : '')}>
      <Link href="/" className="sidebar-logo" aria-label="Vidzo home"><Wordmark/></Link>
      <div className="workspace-switch"><span className="workspace-avatar">V</span><div><strong>Your workspace</strong><small>{demo ? 'Demo studio' : 'Private studio'}</small></div><span className="beta-badge">BETA</span></div>
      <Link className="button primary new-project-button" href="/projects?new=1" onClick={() => setMenu(false)}><Plus size={18}/>New project</Link>
      <span className="nav-caption">WORKSPACE</span>
      <nav aria-label="Workspace"><ul>{items.map(({ href, label, Icon }) => <li key={href}><Link href={href} onClick={() => setMenu(false)} aria-current={path.startsWith(href) || (href === '/projects' && path.startsWith('/studio')) ? 'page' : undefined}><Icon size={19}/>{label}</Link></li>)}{role === 'admin' && <li><Link href="/admin"><ShieldCheck size={19}/>Admin</Link></li>}</ul></nav>
      <div className="sidebar-bottom"><div className="credit-box"><div><Sparkles size={16}/><strong>{wallet.available} credits</strong></div><small>{wallet.held} reserved · {wallet.spent} spent</small><Link href="/wallet">{demo ? 'Explore the wallet' : 'Add credits'}</Link></div><Link className="support-link" href="/support"><LifeBuoy size={18}/>Help & support</Link><div className="user-line"><span className="user-avatar">Y</span><div><strong>Your creative space</strong><small>{demo ? 'Saved on this device' : 'Secure workspace'}</small></div></div></div>
    </aside>
    <div className="app-body"><header className="app-topbar"><span>THE CREATIVE STUDIO</span><div><span className="privacy-tag"><ShieldCheck size={14}/>Private by design</span><Link href="/pricing">Pricing</Link></div></header>
      {demo && <div className="demo-banner"><span><strong>Explore mode.</strong> Your drafts stay on this device. AI and payments are simulated.</span><Link href="/signin">Set up your account</Link></div>}
      {error && <div className="error-banner" role="alert">{error} <Link href="/signin">Sign in</Link></div>}
      <main id="content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
