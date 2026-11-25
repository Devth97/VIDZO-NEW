'use client';
import { useState } from 'react';
import { UploadCloud, FileVideo, ShieldCheck, Check, ScanLine, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '../workspace-provider';
import { ErrorMessage, MediaPlaceholder } from '../ui';
import { readVideoSeconds } from '../backend';
import { referenceAsset, referenceLimits, setRoles, updateAnalysisText, validateReference } from '@/lib/domain/project';
import type { Analysis } from '@/lib/domain/schema';
import { PrivateMedia, type StepProps } from './shared';

export function ReferenceStep({ project: p, actions }: StepProps) {
  const { demo } = useWorkspace();
  const [error, setError] = useState(''), [uploading, setUploading] = useState(false), [dragging, setDragging] = useState(false);
  const source = referenceAsset(p);
  async function pick(file?: File) {
    if (!file) return;
    setError(''); setUploading(true);
    try {
      if (!p.rights) throw new Error('Confirm your rights before uploading a reference.');
      if (!['video/mp4', 'video/quicktime'].includes(file.type)) throw new Error('Use an MP4 or MOV video.');
      if (file.size > referenceLimits.maxBytes) throw new Error('Your file exceeds the 100 MB limit.');
      const seconds = await readVideoSeconds(file);
      validateReference({ mime: file.type, bytes: file.size, seconds, rights: p.rights });
      const asset = await actions.upload(file, 'reference');
      if (asset?.status === 'rejected') setError(`We couldn’t use that file: ${asset.rejectReason ?? 'it failed verification'} Nothing was charged.`);
    } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
  }
  return <div className="studio-columns">
    <section className="panel">
      <div className="section-head"><h3>Your creative starting point</h3><span className="badge">MP4 / MOV · 5–30 s</span></div>
      <p className="muted small-text">Upload a reference you own or have permission to use. We study its concept, then help you make something original.</p>
      <label className="check-label" style={{ marginTop: 20 }}><input type="checkbox" checked={p.rights} disabled={p.sample} onChange={e => actions.change({ ...p, rights: e.target.checked })}/>I own this reference or have permission to use it, including any people, music and trademarks it contains.</label>
      {p.sample ? <div style={{ marginTop: 20 }}><MediaPlaceholder label="Text-only sample project"/><p className="small-text muted" style={{ marginTop: 12 }}>This sample contains an illustrative brief. No reference video or generated ad is included.</p></div> : source && <div style={{ marginTop: 20 }}>
        {source.status !== 'rejected' && <PrivateMedia asset={source} alt="Your reference video" className="reference-media"/>}
        <div className="asset-row"><FileVideo size={20}/><div><strong>{source.name}</strong><small>{source.seconds ? `${source.seconds.toFixed(1)} s · ` : ''}{(source.bytes / 1_000_000).toFixed(1)} MB{source.codec ? ` · ${source.codec.trim()}` : ''}</small></div>
          <span className={'badge ' + (source.status === 'verified' ? 'success' : source.status === 'rejected' ? 'danger' : '')}>{source.status === 'verified' ? (demo ? 'Checked in this browser' : 'Verified') : source.status === 'rejected' ? 'Rejected' : 'Verifying'}</span></div>
        {source.status === 'rejected' && <p className="notice warning"><AlertTriangle size={16}/>{source.rejectReason} Upload another file; nothing was charged.</p>}
      </div>}
      {!p.sample && <div className={'upload-zone' + (dragging ? ' dragging' : '')} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void pick(e.dataTransfer.files[0]); }}>
        <UploadCloud size={30}/><h3>{uploading ? 'Uploading and verifying…' : source ? 'Replace your reference' : 'Drop your reference here'}</h3><p>5–30 seconds · Up to 100 MB · MP4 or MOV</p>
        <label htmlFor="reference-file" className="button secondary">Choose a video</label>
        <input id="reference-file" className="sr-only" type="file" accept="video/mp4,video/quicktime,.mp4,.mov" disabled={uploading || actions.busy} onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }}/>
      </div>}
      <ErrorMessage message={error}/>
      {demo && !p.sample && <p className="notice warning">Explore mode keeps your upload in this browser. AI analysis needs an account; you can continue with an illustrative analysis.</p>}
      {source && !p.sample && <p className="small-text muted" style={{ marginTop: 12 }}>Replacing the reference keeps your storyboard; review the analysis again afterwards.</p>}
    </section>
    <aside className="panel studio-aside"><ShieldCheck size={24}/><h3 style={{ marginTop: 16 }}>Inspiration, with permission.</h3><p>Keep the creative spark. Create new expression.</p>
      <ul className="check-list"><li><Check size={15}/>We verify the real file: container, codec and duration</li><li><Check size={15}/>Invalid files are rejected without charge</li><li><Check size={15}/>No reference audio or watermarks in exports</li><li><Check size={15}/>Private storage, never a public gallery</li></ul>
      <hr className="divider"/><p className="small-text muted">Changing a character alone doesn’t clear copyright. You’ll review the concept, claims and likeness before delivery.</p></aside>
  </div>;
}

const sourceLabel: Record<Analysis['source'], string> = { sample: 'Illustrative analysis', 'local-test': 'Local test analysis · no AI model', model: 'AI analysis · please review' };

export function AnalysisStep({ project: p, actions }: StepProps) {
  const { demo } = useWorkspace();
  const [error, setError] = useState(''), [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
  const a = p.analysis;
  const edit = (patch: Parameters<typeof updateAnalysisText>[1]) => { try { actions.change(updateAnalysisText(p, patch)); setError(''); } catch (e) { setError((e as Error).message); } };
  const roles = (count: number) => { if (!a) return; try { actions.change(setRoles(p, Array.from({ length: count }, (_, i) => a.roles[i] ?? { id: 'role-' + (i + 1), description: i === 0 ? 'Adult presenter' : 'Adult supporting character', confidence: 0.5 }))); } catch (e) { setError((e as Error).message); } };
  const commitRole = (id: string) => { const d = roleDraft[id]; if (!a || d === undefined) return; actions.change(setRoles(p, a.roles.map(r => (r.id === id ? { ...r, description: d.trim() || r.description } : r)))); setRoleDraft(({ [id]: _drop, ...rest }) => rest); };
  if (!a) {
    const running = p.status === 'analyzing';
    return <div className="panel empty-state"><ScanLine size={32}/><h3>Find the idea behind the ad.</h3>
      <p>We read the hook, shots, product moments and character roles. Every detail stays editable.</p>
      <button className="button primary" onClick={() => void actions.analyze()} disabled={actions.busy || running}>{running ? 'Analysing…' : demo ? 'Use an illustrative analysis' : 'Analyse my reference'}</button>
      <p className="small-text muted">{demo ? 'Explore mode cannot watch your video; you will describe the concept yourself.' : 'One free analysis per account per day. Technical failures don’t count.'}</p>
      <ErrorMessage message={error}/></div>;
  }
  const dur = a.durationMs ?? Math.max(...a.shots.map(s => s.endMs));
  return <div className="studio-columns">
    <div>
      <section className="panel">
        <div className="section-head"><h3>The creative read</h3><span className="badge">{sourceLabel[a.source]}</span></div>
        <div className="field"><label htmlFor="analysis-summary">Concept summary</label><textarea id="analysis-summary" maxLength={5000} value={a.summary} onChange={e => edit({ summary: e.target.value })}/></div>
        <div className="field"><label htmlFor="analysis-hook">Opening hook</label><input id="analysis-hook" maxLength={2000} value={a.hook} onChange={e => edit({ hook: e.target.value })}/></div>
        <div className="field"><label htmlFor="analysis-cta">Reference call to action</label><input id="analysis-cta" maxLength={500} value={a.cta} onChange={e => edit({ cta: e.target.value })}/></div>
        <div className="field"><label htmlFor="role-count">Character roles</label>
          <select id="role-count" value={a.roles.length} onChange={e => roles(Number(e.target.value))}><option value={0}>No people — product only</option><option value={1}>One role — 3 original alternatives</option><option value={2}>Two roles — 2 alternatives each</option></select>
          <p className="small-text muted" style={{ marginTop: 6 }}>Changing roles affects only scenes and identities that use them.</p></div>
        {a.roles.map((role, i) => <div className="field" key={role.id}><label htmlFor={role.id}>Role {i + 1}{a.source === 'model' ? ` · ${Math.round(role.confidence * 100)}% model confidence` : ''}</label>
          <input id={role.id} maxLength={200} value={roleDraft[role.id] ?? role.description} onChange={e => setRoleDraft(d => ({ ...d, [role.id]: e.target.value }))} onBlur={() => commitRole(role.id)}/>
          <p className="small-text muted" style={{ marginTop: 6 }}>Editing a role description creates fresh identity options for that role.</p></div>)}
        <ErrorMessage message={error}/>
      </section>
      <section className="panel" style={{ marginTop: 24 }}>
        <h3>Reference shot breakdown</h3><p className="small-text muted" style={{ margin: '8px 0 20px' }}>The source concept only, within the {(dur / 1000).toFixed(1)} s reference. Your original storyboard comes later.</p>
        {a.shots.map((s, i) => <div className="shot-edit" key={s.id}>
          <div className="shot-times"><label htmlFor={s.id + '-start'} className="sr-only">Shot {i + 1} start in seconds</label><input id={s.id + '-start'} type="number" min={0} max={dur / 1000} step={0.1} value={s.startMs / 1000} onChange={e => edit({ shots: a.shots.map(x => (x.id === s.id ? { ...x, startMs: Math.round(Number(e.target.value) * 1000) } : x)) })}/>
            <span aria-hidden="true">–</span><label htmlFor={s.id + '-end'} className="sr-only">Shot {i + 1} end in seconds</label><input id={s.id + '-end'} type="number" min={0} max={dur / 1000} step={0.1} value={s.endMs / 1000} onChange={e => edit({ shots: a.shots.map(x => (x.id === s.id ? { ...x, endMs: Math.round(Number(e.target.value) * 1000) } : x)) })}/><span className="small-text muted">s</span></div>
          <div className="shot-fields"><label className="sr-only" htmlFor={s.id + '-action'}>Shot {i + 1} product moment</label><input id={s.id + '-action'} value={s.productAction} maxLength={500} onChange={e => edit({ shots: a.shots.map(x => (x.id === s.id ? { ...x, productAction: e.target.value } : x)) })}/>
            <label className="sr-only" htmlFor={s.id + '-camera'}>Shot {i + 1} camera and lighting</label><input id={s.id + '-camera'} value={s.camera} maxLength={300} onChange={e => edit({ shots: a.shots.map(x => (x.id === s.id ? { ...x, camera: e.target.value } : x)) })}/></div>
        </div>)}
      </section>
    </div>
    <aside className="panel studio-aside"><h3>A starting point,<br/><em>not a verdict.</em></h3><p>Correct anything the analysis missed. People are described by role only; we never identify anyone in your reference.</p><hr className="divider"/><h3>Review notes</h3><ul className="check-list">{a.risks.map((risk, i) => <li key={i}><ShieldCheck size={15}/>{risk}</li>)}</ul></aside>
  </div>;
}
