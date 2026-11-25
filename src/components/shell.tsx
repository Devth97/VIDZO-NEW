'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { FolderOpen, Image, Users, Wallet, LifeBuoy, Plus, Menu, X, ShieldCheck, Sparkles, LogOut, FlaskConical } from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { Loading, Wordmark } from './ui';

const items = [{ href: '/projects', label: 'Projects', Icon: FolderOpen }, { href: '/assets', label: 'Brand assets', Icon: Image }, { href: '/characters', label: 'Characters', Icon: Users }, { href: '/wallet', label: 'Wallet', Icon: Wallet }, { href: '/support', label: 'Support', Icon: LifeBuoy }];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { wallet, mode, role, error, email, signedOut, ready } = useWorkspace();
  const [menu, setMenu] = useState(false);
  async function signOutNow() { await fetch('/api/auth/signout', { method: 'POST' }).catch(() => undefined); window.location.href = '/'; }
  const nav = [...items, ...(role === 'admin' ? [{ href: '/admin', label: 'Admin', Icon: ShieldCheck }] : [])];
  return <div className="app-layout">
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="mobile-header"><Link href="/" aria-label="Vidzo home"><Wordmark/></Link><button className="icon-button" onClick={() => setMenu(!menu)} aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} aria-controls="workspace-sidebar">{menu ? <X/> : <Menu/>}</button></header>
    <aside id="workspace-sidebar" className={'sidebar ' + (menu ? 'is-open' : '')}>
      <Link href="/" className="sidebar-logo" aria-label="Vidzo home"><Wordmark/></Link>
      <div className="workspace-switch"><span className="workspace-avatar">V</span><div><strong>Your workspace</strong><small>{mode === 'demo' ? 'Explore mode' : mode === 'local' ? 'Local test backend' : 'Private studio'}</small></div><span className="beta-badge">BETA</span></div>
      <Link className="button primary new-project-button" href="/projects?new=1" onClick={() => setMenu(false)}><Plus size={18}/>New project</Link>
      <span className="nav-caption">WORKSPACE</span>
      <nav aria-label="Workspace"><ul>{nav.map(({ href, label, Icon }) => <li key={href}><Link href={href} onClick={() => setMenu(false)} aria-current={path.startsWith(href) || (href === '/projects' && path.startsWith('/studio')) ? 'page' : undefined}><Icon size={19}/>{label}</Link></li>)}</ul></nav>
      <div className="sidebar-bottom">
        <div className="credit-box"><div><Sparkles size={16}/><strong>{wallet.available} credits</strong></div><small>{wallet.held} held · {wallet.spent} spent{mode === 'demo' ? ' · simulated' : ''}</small><Link href="/wallet">{mode === 'demo' ? 'How credits work' : 'Add credits'}</Link></div>
        <div className="user-line"><span className="user-avatar">{(email ?? 'Y')[0].toUpperCase()}</span><div><strong>{email ?? 'Explore mode'}</strong><small>{mode === 'demo' ? 'Saved on this device' : 'Private workspace'}</small></div>{mode !== 'demo' && !signedOut && <button className="icon-button" onClick={() => void signOutNow()} aria-label="Sign out"><LogOut size={16}/></button>}</div>
      </div>
    </aside>
    <div className="app-body">
      <header className="app-topbar"><span>THE CREATIVE STUDIO</span><div><span className="privacy-tag"><ShieldCheck size={14}/>Private by design</span><Link href="/pricing">Pricing</Link></div></header>
      {mode === 'demo' && <div className="demo-banner"><span><strong>Explore mode.</strong> Drafts stay in this browser. AI, credits and payments are simulated; outputs are labelled placeholders.</span><Link href="/signin">About accounts</Link></div>}
      {mode === 'local' && <div className="demo-banner local"><FlaskConical size={16}/><span><strong>Local test backend.</strong> Real database, storage, ledger and webhooks on this machine; AI providers and payments are simulated.</span></div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      <main id="content" tabIndex={-1}>{!ready ? <Loading/> : signedOut ? <SignInGate path={path}/> : children}</main>
    </div>
  </div>;
}

function SignInGate({ path }: { path: string }) {
  return <div className="page-container"><div className="empty-state panel"><ShieldCheck size={30}/><h1>Sign in to your studio</h1><p>Your projects, brand files and credits are private to your workspace.</p><Link className="button primary" href={'/signin?next=' + encodeURIComponent(path)}>Sign in with email</Link></div></div>;
}
