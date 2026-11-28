'use client';
import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { ErrorMessage } from '@/components/ui';

type Attempt = { task: string; kind: string; provider: string; endpoint: string; status: string; tries: number; requestId: string | null; error: string | null };
type Job = { id: string; kind: string; status: string; stage: string; error: string | null; needs_attention: boolean; credits_reserved: number; credits_settled: number; created_at: string; email: string; attempts: Attempt[] };
type Limits = { dailySpendCapInr: number; perUserConcurrency: number; generationPaused: boolean; freeAnalysesPerDay: number; circuitBreakers: Record<string, 'open' | 'closed'> };
type Runner = { at: string; due: number; advanced: number; errors: number; active: number; attention: number; ms: number };
type Overview = { runner: Runner | null; jobs: Job[]; qa: { id: string; projectId: string; name: string; placeholder: boolean; mime: string; url: string; createdAt: string }[]; limits: Limits; committedCreditsToday: number; tickets: { id: string; subject: string; body: string; email: string; created_at: string }[]; payments: { id: string; order_id: string; credits: number; amount_paise: number; status: string; failure_reason: string | null; created_at: string }[] };

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed.');
  return d;
}

export default function AdminPage() {
  const { role, notify } = useWorkspace();
  const [data, setData] = useState<Overview>(), [error, setError] = useState(''), [limits, setLimits] = useState<Limits>(), [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try { const r = await fetch('/api/admin/overview'); const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); setLimits(d.limits); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (role === 'admin') void load(); }, [role, load]);
  const act = async (fn: () => Promise<unknown>, msg: string) => { setError(''); try { await fn(); notify(msg); await load(); } catch (e) { setError((e as Error).message); } };
  if (role !== 'admin') return <div className="page-container"><div className="empty-state panel"><ShieldCheck size={28}/><h1>Admin access required</h1><p>This area is limited to the VIDZO operations team.</p></div></div>;
  return <div className="page-container">
    <div className="page-heading"><div><p className="eyebrow">Operations</p><h1>Admin<span className="serif-dot">.</span></h1><p>Quality review, job diagnostics, spend controls and support.</p></div></div>
    <ErrorMessage message={error}/>
    {data && limits && <>
      <div className="stats-grid"><div className="stat-card"><span>Credits committed today</span><strong>{data.committedCreditsToday}</strong><small>Cap ₹{limits.dailySpendCapInr.toLocaleString('en-IN')} of credit value</small></div><div className="stat-card"><span>Needs attention</span><strong>{data.jobs.filter(j => j.needs_attention).length}</strong><small>Unknown provider outcomes or jobs over an hour old</small></div><div className="stat-card"><span>Background runner</span><strong>{data.runner ? `${Math.max(0, Math.round((Date.now() - new Date(data.runner.at).getTime()) / 60_000))} min` : 'Never'}</strong><small>{data.runner ? `since the last sweep · ${data.runner.active} active, ${data.runner.advanced} advanced${data.runner.errors ? `, ${data.runner.errors} errors` : ''}` : 'No sweep recorded. Check the Worker cron trigger.'}</small></div><div className="stat-card"><span>Awaiting QA</span><strong>{data.qa.length}</strong><small>Exports blocked from download</small></div></div>

      <section className="projects-section"><h2>Quality review</h2>
        {data.qa.length === 0 ? <p className="muted small-text">No exports waiting.</p> : data.qa.map(q => <article key={q.id} className="panel admin-row">
          <div><strong>{q.name}</strong><small className="muted">{new Date(q.createdAt).toLocaleString('en-IN')} {q.placeholder ? '· test placeholder (not an MP4)' : ''}</small>
            {q.mime === 'video/mp4' ? <video controls src={q.url} style={{ maxHeight: 320 }}><track kind="captions"/></video> : <a className="text-button" href={q.url} target="_blank" rel="noreferrer">Open file</a>}</div>
          <div><label htmlFor={'note-' + q.id}>Review note (required to reject)</label><textarea id={'note-' + q.id} value={notes[q.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [q.id]: e.target.value }))}/>
            <div className="inline-actions"><button className="button primary" onClick={() => void act(() => post('/api/admin/qa', { exportAssetId: q.id, decision: 'approved', note: notes[q.id] }), 'Approved for download.')}>Approve for download</button><button className="button danger" onClick={() => void act(() => post('/api/admin/qa', { exportAssetId: q.id, decision: 'rejected', note: notes[q.id] }), 'Rejected with note.')}>Reject</button></div></div>
        </article>)}</section>

      <section className="projects-section"><h2>Spend and safety limits</h2>
        <form className="panel limits-form" onSubmit={e => { e.preventDefault(); void act(() => post('/api/admin/settings', limits), 'Limits saved.'); }}>
          <div className="field-grid"><div className="field"><label htmlFor="cap">Daily credit-value cap (₹)</label><input id="cap" type="number" min={0} value={limits.dailySpendCapInr} onChange={e => setLimits({ ...limits, dailySpendCapInr: Number(e.target.value) })}/></div>
            <div className="field"><label htmlFor="conc">Concurrent jobs per user</label><input id="conc" type="number" min={1} max={5} value={limits.perUserConcurrency} onChange={e => setLimits({ ...limits, perUserConcurrency: Number(e.target.value) })}/></div>
            <div className="field"><label htmlFor="free">Free analyses per user per day</label><input id="free" type="number" min={0} max={10} value={limits.freeAnalysesPerDay ?? 1} onChange={e => setLimits({ ...limits, freeAnalysesPerDay: Number(e.target.value) })}/></div></div>
          <label className="check-label"><input type="checkbox" checked={limits.generationPaused} onChange={e => setLimits({ ...limits, generationPaused: e.target.checked })}/>Pause all new generation (circuit breaker)</label>
          {['fal', 'media-worker', 'simulated'].map(p => <label key={p} className="check-label"><input type="checkbox" checked={limits.circuitBreakers[p] === 'open'} onChange={e => setLimits({ ...limits, circuitBreakers: { ...limits.circuitBreakers, [p]: e.target.checked ? 'open' : 'closed' } })}/>Block provider “{p}”</label>)}
          <button className="button primary">Save limits</button></form></section>

      <section className="projects-section"><h2>Jobs</h2><div className="table-wrap"><table className="price-table"><thead><tr><th scope="col">Created</th><th scope="col">User</th><th scope="col">Kind</th><th scope="col">Status</th><th scope="col">Credits</th><th scope="col">Attempts</th><th scope="col">Action</th></tr></thead><tbody>
        {data.jobs.map(j => <tr key={j.id} className={j.needs_attention ? 'attention' : ''}><td>{new Date(j.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{j.email}</td><td>{j.kind}</td><td>{j.needs_attention && <AlertTriangle size={13}/>} {j.status}<br/><small className="muted">{j.stage}</small>{j.error && <><br/><small>{j.error}</small></>}</td><td>{j.credits_settled}/{j.credits_reserved}</td>
          <td>{j.attempts.map(a => <div key={a.task} className="small-text mono">{a.provider}:{a.status} ×{a.tries}{a.requestId ? ` · ${a.requestId.slice(0, 14)}` : ''}{a.error ? ` · ${a.error.slice(0, 60)}` : ''}</div>)}</td>
          <td>{j.needs_attention && <div className="inline-actions">{j.attempts.some(a => a.status === 'unknown' || a.status === 'submitting') && <button className="button secondary" onClick={() => void act(() => post(`/api/admin/jobs/${j.id}/resolve`, { action: 'mark_failed' }), 'Marked failed; credits released.')}>Mark failed &amp; release</button>}<button className="text-button" onClick={() => { if (confirm('Stop every unfinished item of this job? Delivered items stay; credits for the rest are released.')) void act(() => post(`/api/admin/jobs/${j.id}/resolve`, { action: 'stop_remaining' }), 'Stopped; unfinished credits released.'); }}>Stop unfinished</button><button className="text-button" onClick={() => { if (confirm('Resubmitting may create a duplicate provider charge if the first request actually ran. Continue?')) void act(() => post(`/api/admin/jobs/${j.id}/resolve`, { action: 'resubmit' }), 'Resubmitted.'); }}>Resubmit</button></div>}</td></tr>)}
      </tbody></table></div></section>

      <section className="projects-section"><h2>Open support requests</h2>{data.tickets.length === 0 ? <p className="muted small-text">None open.</p> : data.tickets.map(t => <article key={t.id} className="panel admin-row"><div><strong>{t.subject}</strong><small className="muted">{t.email} · {new Date(t.created_at).toLocaleString('en-IN')}</small><p className="small-text">{t.body}</p></div><button className="button secondary" onClick={() => void act(() => post(`/api/admin/tickets/${t.id}`, {}), 'Closed.')}>Close</button></article>)}</section>

      <section className="projects-section"><h2>Recent payments</h2><div className="table-wrap"><table className="price-table"><thead><tr><th scope="col">Order</th><th scope="col">Credits</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead><tbody>{data.payments.map(p => <tr key={p.id}><td className="mono">{p.order_id}</td><td>{p.credits}</td><td>₹{(p.amount_paise / 100).toLocaleString('en-IN')}</td><td>{p.status}{p.failure_reason ? ` · ${p.failure_reason}` : ''}</td></tr>)}</tbody></table></div></section>
    </>}
  </div>;
}
