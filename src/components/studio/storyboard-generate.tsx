'use client';
import { useState } from 'react';
import { Check, Lock, LockOpen, RefreshCw, Film, Download, ShieldCheck, Sparkles, Plus, Trash2, AlertTriangle, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { useWorkspace } from '../workspace-provider';
import { ErrorMessage, MediaPlaceholder } from '../ui';
import { addScene, allClipsCurrent, currentExport, removeScene, sceneLimits, sceneState, toggleLock, totalSeconds, updateScene } from '@/lib/domain/project';
import type { Tier } from '@/lib/domain/schema';
import { JobStatus, PrivateMedia, type StepProps } from './shared';

export function StoryboardStep({ project: p, actions }: StepProps) {
  const { pricing } = useWorkspace();
  const [error, setError] = useState('');
  const roles = p.analysis?.roles ?? [];
  const total = totalSeconds(p);
  const states = p.scenes.map(s => sceneState(p, s));
  const approved = states.filter(s => s.approved).length;
  const missingFrames = p.scenes.filter((s, i) => !states[i].frame && !s.locked).length;
  const run = (fn: () => typeof p) => { try { actions.change(fn()); setError(''); } catch (e) { setError((e as Error).message); } };
  return <>
    <div className="notice"><Film size={18}/><span>New compositions for <strong>{p.brief.brand || 'your brand'}</strong>, separate from the reference. Create and approve a frame for every scene before any video is generated.</span></div>
    <div className="storyboard-bar">
      <span className={'badge ' + (total >= sceneLimits.minTotal && total <= sceneLimits.maxTotal ? 'success' : 'danger')}>{total} s of 10–15 s</span>
      <span className="badge">{approved}/{p.scenes.length} approved</span>
      <span className="small-text muted">Vertical 9:16 · up to four scenes</span>
      <div className="inline-actions">
        {p.scenes.length < sceneLimits.max && <button className="button secondary" onClick={() => run(() => addScene(p))} disabled={actions.busy}><Plus size={15}/>Add scene</button>}
        {missingFrames > 0 && <button className="button primary" onClick={() => actions.requestQuote('frame')} disabled={actions.busy}><Sparkles size={15}/>Create {missingFrames} frame{missingFrames > 1 ? 's' : ''}{pricing ? ` · ${missingFrames * pricing.frame} credits` : ''}</button>}
      </div>
    </div>
    <ErrorMessage message={error}/>
    <div className="scene-grid">{p.scenes.map((s, i) => {
      const st = states[i];
      return <article className={'scene-card ' + (st.approved ? 'is-approved' : '')} key={s.id}>
        <div className="scene-card-header"><strong>SCENE {String(i + 1).padStart(2, '0')}</strong><span>{s.seconds}s · v{s.version}</span></div>
        {st.frame ? <PrivateMedia asset={st.frame} alt={`${s.title} storyboard frame`} className="frame-media"/> : <div className="frame-empty"><MediaPlaceholder small label=""/><span>{st.frames ? 'Earlier frames no longer match this scene' : 'No frame yet'}</span></div>}
        <div className="scene-card-body">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <label className="sr-only" htmlFor={'title-' + s.id}>Scene {i + 1} title</label>
            <input id={'title-' + s.id} className="title-input" value={s.title} maxLength={120} disabled={s.locked} onChange={e => run(() => updateScene(p, s.id, { title: e.target.value }))}/>
            <button className="icon-button" onClick={() => run(() => toggleLock(p, s.id))} aria-pressed={s.locked} aria-label={s.locked ? `Unlock ${s.title}` : `Lock ${s.title}`}>{s.locked ? <Lock size={16}/> : <LockOpen size={16}/>}</button>
          </div>
          <label className="sr-only" htmlFor={'prompt-' + s.id}>Scene {i + 1} description</label>
          <textarea id={'prompt-' + s.id} value={s.prompt} maxLength={4000} disabled={s.locked || actions.busy} onChange={e => run(() => updateScene(p, s.id, { prompt: e.target.value }))}/>
          <div className="scene-controls">
            <label htmlFor={'secs-' + s.id}>Length<select id={'secs-' + s.id} value={s.seconds} disabled={s.locked} onChange={e => run(() => updateScene(p, s.id, { seconds: Number(e.target.value) }))}>{[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} s</option>)}</select></label>
            {roles.length > 0 && <fieldset><legend>Characters</legend>{roles.map(r => <label key={r.id} className="check-label"><input type="checkbox" disabled={s.locked} checked={s.roleIds.includes(r.id)} onChange={e => run(() => updateScene(p, s.id, { roleIds: e.target.checked ? [...s.roleIds, r.id] : s.roleIds.filter(x => x !== r.id) }))}/>{r.description}</label>)}</fieldset>}
          </div>
          <p className={'scene-state ' + (st.approved ? 'ok' : st.approvalStale ? 'warn' : '')}>{st.approved ? <><Check size={14}/>Approved{st.clip ? ' · clip current' : st.clipStale ? ' · clip needs regenerating' : ''}</> : st.approvalStale ? <><AlertTriangle size={14}/>Changed since approval — review a new frame</> : st.frame ? 'Ready for your approval' : 'Create a frame to approve'}</p>
          <div className="scene-card-actions">
            <button className={'button ' + (st.approved ? 'subtle' : 'primary')} disabled={actions.busy || !st.frame || st.approved} onClick={() => st.frame && void actions.approve(s.id, st.frame.id)}><Check size={14}/>{st.approved ? 'Approved' : 'Approve frame'}</button>
            <button className="button secondary" onClick={() => actions.requestQuote('frame', s.id)} disabled={actions.busy || s.locked}><RefreshCw size={14}/>{st.frame ? 'Redraw' : 'Create'} frame</button>
            {p.scenes.length > 1 && <button className="icon-button" onClick={() => run(() => removeScene(p, s.id))} disabled={s.locked || actions.busy} aria-label={`Remove ${s.title}`}><Trash2 size={16}/></button>}
          </div>
          {s.history.length > 0 && <details className="history"><summary>{s.history.length} earlier version{s.history.length > 1 ? 's' : ''}</summary><ol>{[...s.history].reverse().slice(0, 8).map(h => <li key={h.version + h.at}><strong>v{h.version}</strong> · {h.seconds}s — {h.prompt}</li>)}</ol></details>}
        </div>
      </article>;
    })}</div>
    <div className="panel" style={{ marginTop: 24 }}><h3>What changes from the reference?</h3><p style={{ marginTop: 8 }}>{p.brief.differences || 'Add the new creative expression in your brief: compositions, story, copy and original identities.'}</p>
      <p className="small-text muted" style={{ marginTop: 12 }}>Editing a scene affects only that scene’s frame, approval and clip, plus the final assembly. Other scenes keep their work. Undoing an edit restores the earlier frame.</p></div>
  </>;
}

export function GenerateStep({ project: p, actions, tier, setTier }: StepProps & { tier: Tier; setTier: (t: Tier) => void }) {
  const { pricing } = useWorkspace();
  const states = p.scenes.map(s => sceneState(p, s));
  const needs = p.scenes.filter((_, i) => !states[i].clip);
  const secs = needs.reduce((n, s) => n + s.seconds, 0);
  return <div className="studio-columns"><div>
    <div className="tier-grid">{(['professional', 'premium'] as const).map(t => <label key={t} className={'tier-card ' + (tier === t ? 'selected' : '')}>
      <div><span className="badge">{t === 'professional' ? 'PRODUCT-FOCUSED' : 'COMPLEX MOTION'}</span><input type="radio" name="tier" checked={tier === t} onChange={() => setTier(t)}/></div>
      <h3>{t === 'professional' ? 'Professional' : 'Premium'}</h3>
      <p>{t === 'professional' ? 'Clean product scenes from a benchmarked production model.' : 'Specialist models for demanding motion and interactions.'}</p>
      <strong>{pricing ? `${pricing.perSecond[t]} credits / second` : 'Pricing not configured'}</strong>
      <small className="muted">{pricing ? `${secs ? `${secs * pricing.perSecond[t]} credits for the ${secs} s still needed` : 'All clips are current'}${pricing.illustrative ? ' · placeholder rate' : ''}` : 'Quotes unavailable until pricing is set'}</small></label>)}</div>
    {actions.job && <JobStatus job={actions.job} onRetry={actions.retry}/>}
    <section className="panel"><h3>A clear quote. A confident decision.</h3>
      <div style={{ marginTop: 16 }}>
        <div className="quote-detail"><span>Scenes to generate</span><strong>{needs.length ? `${needs.length} of ${p.scenes.length} (${secs} s)` : 'None — all current'}</strong></div>
        <div className="quote-detail"><span>Delivery target</span><strong>1080 × 1920 MP4 · 30 fps</strong></div>
        <div className="quote-detail"><span>Native resolution</span><strong>{pricing?.nativeResolution[tier] ?? 'Disclosed with the quote'}</strong></div>
        <div className="quote-detail"><span>Technical failures</span><strong>Unsettled credits released</strong></div>
        <div className="quote-detail"><span>Creative revisions</span><strong>Separate quote, with consent</strong></div>
      </div>
      <p className="small-text muted" style={{ margin: '20px 0' }}>No subscription. Nothing is charged beyond the quote you confirm. Scenes that already have a current clip are not regenerated.</p>
      <button className="button primary full" disabled={actions.busy || !needs.length} onClick={() => actions.requestQuote('video')}><Sparkles size={17}/>Review generation quote</button>
    </section>
    <section className="panel" style={{ marginTop: 24 }}><h3>Review by scene</h3>
      {p.scenes.map((s, i) => <div key={s.id} className="clip-row"><div><strong>Scene {i + 1} · {s.title}</strong><small className="muted">{s.seconds}s · {states[i].clip ? 'Clip current' : states[i].clipStale ? 'Earlier clip no longer matches' : 'Not generated'}</small></div>
        {states[i].clip && <PrivateMedia asset={states[i].clip} alt={`Scene ${i + 1} clip`} className="clip-media"/>}
        {states[i].clip && <button className="text-button" onClick={() => actions.requestQuote('scene', s.id)} disabled={actions.busy}>Quote a revision</button>}</div>)}
    </section></div>
    <aside className="panel studio-aside"><ShieldCheck size={24}/><h3 style={{ marginTop: 16 }}>You stay in control.</h3><ul className="check-list"><li><Check size={15}/>Maximum credits shown before you confirm</li><li><Check size={15}/>Credits are held, then settled per finished clip</li><li><Check size={15}/>Repeat clicks never create a second charge</li><li><Check size={15}/>A quality concern goes to review before any paid redraw</li></ul></aside></div>;
}

export function ExportStep({ project: p, actions, onSimulateReview }: StepProps & { onSimulateReview?: () => void }) {
  const { backend, demo, pricing } = useWorkspace();
  const [error, setError] = useState('');
  const exp = currentExport(p), ready = allClipsCurrent(p);
  const approved = p.qa?.exportAssetId === exp?.id && p.qa?.decision === 'approved';
  const rejected = p.qa?.exportAssetId === exp?.id && p.qa?.decision === 'rejected';
  async function download() { try { const url = await backend.assetUrl(exp!.id, true); const a = document.createElement('a'); a.href = url; a.download = exp!.name; a.click(); } catch (e) { setError((e as Error).message); } }
  function brief() {
    const { assets: _a, ...rest } = p;
    const blob = new Blob([JSON.stringify({ ...rest, disclosure: 'Creative brief and storyboard. Placeholder or illustrative files are not generated video.' }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `vidzo-${p.id}-brief.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="studio-columns"><div>
    <section className="panel">
      <div className="section-head"><h3>{approved ? 'Your story, ready to share.' : exp ? 'The final look, with a second pair of eyes.' : ready ? 'Every clip is in. Time to assemble.' : 'Your final frame is ahead.'}</h3><span className="badge">1080 × 1920 · 30 fps</span></div>
      {actions.job && <JobStatus job={actions.job} onRetry={actions.retry}/>}
      <div className="download-preview">{exp ? <PrivateMedia asset={exp} alt="Assembled export preview"/> : <MediaPlaceholder label="No export yet"/>}</div>
      {!ready && <p className="notice warning">Generate a current clip for every scene first, in the Generate step.</p>}
      {ready && !exp && <><p className="small-text muted" style={{ margin: '16px 0' }}>Assembly joins your reviewed clips, adds your exact logo and call to action as overlays, and excludes all reference audio.{pricing ? ` ${pricing.export ? `${pricing.export} credits.` : 'No extra credits.'}` : ''}</p>
        <button className="button primary" onClick={() => actions.requestQuote('export')} disabled={actions.busy}>Request final assembly</button></>}
      {exp && !approved && !rejected && <p className="notice"><ShieldCheck size={16}/>A VIDZO reviewer checks product fidelity, likeness, claims and the call to action before download.{demo ? ' Explore mode has no reviewer.' : ''}</p>}
      {exp && rejected && <p className="notice warning"><AlertTriangle size={16}/>Review found an issue: {p.qa?.note} <Link className="text-button" href="/support">Contact support</Link> — quality issues are not charged as paid redraws.</p>}
      {exp?.placeholder && <p className="small-text muted" style={{ marginTop: 12 }}>This export is a test manifest, not an MP4. No AI video exists for this project.</p>}
      <ErrorMessage message={error}/>
      <div className="inline-actions" style={{ marginTop: 16 }}>
        {approved && <button className="button primary" onClick={() => void download()}><Download size={16}/>{exp?.mime === 'video/mp4' ? 'Download MP4' : 'Download manifest'}</button>}
        {demo && exp && !approved && onSimulateReview && <button className="button secondary" onClick={onSimulateReview}>Simulate reviewer approval (demo)</button>}
        <button className="button secondary" onClick={brief}><Download size={16}/>Download creative brief</button>
      </div>
    </section></div>
    <aside className="panel studio-aside"><h3>Delivery notes</h3><ul className="check-list"><li><Check size={15}/>Exact logo and CTA overlaid in assembly</li><li><Check size={15}/>Reference audio and marks excluded</li><li><Check size={15}/>Native resolution and any upscale disclosed</li><li><Check size={15}/>Human quality approval during beta</li></ul><p className="small-text muted"><LifeBuoy size={14}/> A quality concern? <Link href="/support" className="text-button">Contact support</Link> before requesting a paid redraw.</p></aside></div>;
}
