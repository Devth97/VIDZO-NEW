'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Mail, ShieldCheck, FlaskConical } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { ErrorMessage } from '@/components/ui';
import { ConceptImage } from '@/components/concept-image';

export default function SignIn() {
  const { mode, capabilities } = useWorkspace();
  const submitting = useRef(false);
  const [email, setEmail] = useState(''), [accept, setAccept] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false), [localLink, setLocalLink] = useState(''), [next, setNext] = useState('/projects');
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get('next')) setNext(q.get('next')!); if (q.get('error')) setError(q.get('error') === 'google' ? 'Google sign-in was canceled or could not be completed. Please try again.' : 'That sign-in link is invalid, already used or expired. Request a new one.'); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const res = await fetch(mode === 'live' ? '/api/auth/google' : '/api/auth/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(mode === 'local' ? { email } : {}), next, accept }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start sign-in. Please try again.');
      if (mode === 'live') {
        if (typeof data.url !== 'string' || !data.url) throw new Error('Could not start Google sign-in. Please try again.');
        window.location.assign(data.url);
        return;
      }
      setSent(true); setLocalLink(data.localLink ?? '');
      submitting.current = false; setBusy(false);
    } catch (err) { setError((err as Error).message); submitting.current = false; setBusy(false); }
  }
  if (mode === 'demo') return <div className="auth-container panel"><ShieldCheck size={28}/><h1>Accounts are not enabled here</h1><p className="muted">This deployment runs in explore mode: drafts stay in your browser and AI, credits and payments are simulated. Accounts open with the private beta.</p><Link className="button primary full" href="/projects">Continue exploring</Link></div>;
  if (mode === 'live' && capabilities && !capabilities.auth) return <div className="auth-container panel"><h1>Sign-in is being set up</h1><p className="muted">Google sign-in is not configured on this server yet.</p></div>;
  return <div className="auth-editorial"><aside className="auth-story"><ConceptImage id="ritual" priority/><div><p className="eyebrow">YOUR NEXT CREATIVE CHAPTER</p><h2>Make it<br/><em>your own.</em></h2><p>One workspace for your reference, your brand and every creative decision.</p><small>AI-created concept still · not video output</small></div></aside><div className="auth-container panel">
    {sent ? <><Mail size={28}/><h1>Your local sign-in link</h1><p className="muted">A one-time test link is ready for <strong>{email}</strong>. No email was sent. You’ll return to where you left off.</p>
      {localLink && <div className="notice warning" style={{ marginTop: 20 }}><FlaskConical size={16}/><span>Local test backend: no email is sent. <a className="text-button" href={localLink}>Open the sign-in link</a> (also printed in the server console).</span></div>}
      <button className="text-button" onClick={() => setSent(false)}>Use a different email</button></>
    : <><h1>Sign in to Vidzo</h1><p className="muted">{mode === 'live' ? 'Continue with your Google account. New here? Signing in creates your private workspace.' : 'Local test backend — enter an email to create a test workspace. No email is sent.'}</p>
      <form onSubmit={submit} aria-busy={busy}>
        {mode === 'local' && <><label htmlFor="email">Test email</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={email} onChange={e => setEmail(e.target.value)}/></>}
        <label className="check-label" style={{ marginTop: 16 }}><input name="accept" type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} aria-describedby="signin-terms" required/>I agree to the beta terms and privacy notice (required).</label>
        <p id="signin-terms" className="small-text muted">Read the <Link className="text-button" href="/terms" target="_blank">terms</Link> and <Link className="text-button" href="/privacy" target="_blank">privacy notice</Link> (opens a new tab).</p>
        <ErrorMessage message={error}/><button type="submit" className="button primary full" disabled={busy}>{mode === 'live' ? (busy ? 'Opening Google…' : 'Continue with Google') : (busy ? 'Creating link…' : 'Create local sign-in link')}</button></form>
      <p className="small-text muted" style={{ marginTop: 16 }}>New workspaces start with zero credits. You can create drafts and plan your storyboard before buying any.</p></>}
  </div></div>;
}
