'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, ShieldCheck, FlaskConical } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { ErrorMessage } from '@/components/ui';

export default function SignIn() {
  const { mode, capabilities } = useWorkspace();
  const [email, setEmail] = useState(''), [accept, setAccept] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false), [localLink, setLocalLink] = useState(''), [next, setNext] = useState('/projects');
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get('next')) setNext(q.get('next')!); if (q.get('error')) setError('That sign-in link is invalid, already used or expired. Request a new one.'); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, next, accept }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send the link.');
      setSent(true); setLocalLink(data.localLink ?? '');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  if (mode === 'demo') return <div className="auth-container panel"><ShieldCheck size={28}/><h1>Accounts are not enabled here</h1><p className="muted">This deployment runs in explore mode: drafts stay in your browser and AI, credits and payments are simulated. Accounts open with the private beta.</p><Link className="button primary full" href="/projects">Continue exploring</Link></div>;
  if (mode === 'live' && capabilities && !capabilities.auth) return <div className="auth-container panel"><h1>Sign-in is being set up</h1><p className="muted">Email sign-in is not configured on this server yet.</p></div>;
  return <div className="auth-container panel">
    {sent ? <><Mail size={28}/><h1>Check your inbox</h1><p className="muted">We sent a one-time sign-in link to <strong>{email}</strong>. It expires soon and works once. You’ll return to where you left off.</p>
      {localLink && <div className="notice warning" style={{ marginTop: 20 }}><FlaskConical size={16}/><span>Local test backend: no email is sent. <a className="text-button" href={localLink}>Open the sign-in link</a> (also printed in the server console).</span></div>}
      <button className="text-button" onClick={() => setSent(false)}>Use a different email</button></>
    : <><h1>Sign in to Vidzo</h1><p className="muted">Email only — no password. New here? The same link creates your private workspace.</p>
      <form onSubmit={submit}><label htmlFor="email">Work email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/>
        <label className="check-label" style={{ marginTop: 16 }}><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} required/>I agree to the beta terms and privacy notice.</label>
        <p className="small-text muted">Read the <Link className="text-button" href="/terms" target="_blank">terms</Link> and <Link className="text-button" href="/privacy" target="_blank">privacy notice</Link> (opens a new tab).</p>
        <ErrorMessage message={error}/><button className="button primary full" disabled={busy || !accept}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button></form>
      <p className="small-text muted" style={{ marginTop: 16 }}>New workspaces start with zero credits. You can create drafts and plan your storyboard before buying any.</p></>}
  </div>;
}
