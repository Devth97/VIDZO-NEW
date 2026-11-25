'use client';
import { useState } from 'react';
import { LifeBuoy, Check } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { ErrorMessage } from '@/components/ui';

export default function SupportPage() {
  const { backend, projects, mode } = useWorkspace();
  const [subject, setSubject] = useState(''), [body, setBody] = useState(''), [projectId, setProjectId] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await backend.support({ subject, body, projectId: projectId || undefined }); setSent(r.id); setSubject(''); setBody(''); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <div className="page-container">
    <div className="page-heading"><div><p className="eyebrow">SUPPORT</p><h1>We’re here to help<span className="serif-dot">.</span></h1><p>Quality concerns, payment questions or a stuck job — tell us what happened.</p></div></div>
    <div className="studio-columns">
      <section className="panel">
        {sent ? <div className="empty-state"><Check size={28}/><h2>Request received</h2><p>Reference <span className="mono">{sent.slice(0, 8)}</span>. We’ll reply by email during the beta.</p><button className="button secondary" onClick={() => setSent('')}>Send another</button></div>
          : <form onSubmit={submit}>
            {mode === 'demo' && <p className="notice warning">Explore mode has no account, so requests can’t be sent from here.</p>}
            <label htmlFor="s-subject">Subject</label><input id="s-subject" required minLength={3} maxLength={150} value={subject} onChange={e => setSubject(e.target.value)}/>
            <label htmlFor="s-project">Related project (optional)</label><select id="s-project" value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">None</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <label htmlFor="s-body">What happened?</label><textarea id="s-body" required minLength={10} maxLength={5000} value={body} onChange={e => setBody(e.target.value)}/>
            <ErrorMessage message={error}/><button className="button primary" disabled={busy || mode === 'demo'}>{busy ? 'Sending…' : 'Send request'}</button></form>}
      </section>
      <aside className="panel studio-aside"><LifeBuoy size={24}/><h3 style={{ marginTop: 16 }}>Good to know</h3><ul className="check-list"><li><Check size={15}/>Technical failures release held credits automatically</li><li><Check size={15}/>Quality concerns are reviewed before any paid redraw</li><li><Check size={15}/>Payments show as pending until the provider confirms</li><li><Check size={15}/>Never send passwords or card details in a request</li></ul></aside>
    </div>
  </div>;
}
