'use client';
import { useState } from 'react';
import { Check, Lock, LockOpen, RefreshCw, Film, Sparkles, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '../workspace-provider';
import { ErrorMessage, MediaPlaceholder } from '../ui';
import { addScene, fidelityLabels, fidelityNotes, productAssets, removeScene, sceneLimits, sceneState, toggleLock, totalSeconds, updateScene } from '@/lib/domain/project';
import { scenePurposes, type Project, type ScenePurpose } from '@/lib/domain/schema';
import { PrivateMedia, type StepProps } from './shared';

export const purposeLabels: Record<ScenePurpose, string> = { hook: 'Hook', problem: 'Problem', demonstration: 'Demonstration', reveal: 'Product reveal', benefit: 'Benefit', invitation: 'Call to action' };

/** The customer's original product photos and fidelity notes: the yardstick every frame is checked against. */
export function ProductReference({ project: p, compact = false }: { project: Project; compact?: boolean }) {
  const photos = productAssets(p), notes = fidelityNotes(p.brief);
  if (!photos.length && !notes.length) return <p className="small-text muted">{p.sample ? 'The sample has no product photos. Compare frames against your brief.' : 'Add product photos in Brand & brief to compare frames against them.'}</p>;
  return <div className={'product-reference' + (compact ? ' is-compact' : '')}>
    {photos.length > 0 && <ul className="product-reference-photos" aria-label="Your original product photos">{photos.slice(0, compact ? 3 : 6).map(a => <li key={a.id}><PrivateMedia asset={a} alt={`Original product photo: ${a.name}`}/></li>)}</ul>}
    {notes.length > 0
      ? <dl className="fidelity-notes">{notes.map(([k, v]) => <div key={k} className={k === 'prohibited' ? 'is-prohibited' : ''}><dt>{fidelityLabels[k]}</dt><dd>{v}</dd></div>)}</dl>
      : <p className="small-text muted">No fidelity notes yet. Add shape, colour, packaging text and prohibited changes in Brand &amp; brief.</p>}
  </div>;
}

export function StoryboardStep({ project: p, actions }: StepProps) {
  const { pricing } = useWorkspace();
  const [error, setError] = useState('');
  // A product check belongs to one frame: a redrawn frame must be checked again.
  const [checked, setChecked] = useState<Record<string, string>>({});
  const [comparing, setComparing] = useState<Record<string, boolean>>({});
  const roles = p.analysis?.roles ?? [];
  const total = totalSeconds(p);
  const states = p.scenes.map(s => sceneState(p, s));
  const approved = states.filter(s => s.approved).length;
  const missingFrames = p.scenes.filter((s, i) => !states[i].frame && !s.locked).length;
  const needsProductCheck = productAssets(p).length > 0;
  const run = (fn: () => Project) => { try { actions.change(fn()); setError(''); } catch (e) { setError((e as Error).message); } };
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
    <section className="panel product-check-panel" aria-labelledby="product-check-title">
      <div className="section-head"><h3 id="product-check-title">Your product, as supplied</h3><span className="small-text muted">Check every frame against these</span></div>
      <ProductReference project={p}/>
      <p className="small-text muted" style={{ marginTop: 12 }}>Models can alter shape, colour or label text. Approve a frame only when the product matches your originals: video is generated from the approved frame.</p>
    </section>
    <div className="scene-grid">{p.scenes.map((s, i) => {
      const st = states[i];
      const productOk = !needsProductCheck || Boolean(st.frame && checked[s.id] === st.frame.id);
      return <article className={'scene-card ' + (st.approved ? 'is-approved' : '')} key={s.id} aria-labelledby={'scene-label-' + s.id}>
        <div className="scene-card-header"><strong id={'scene-label-' + s.id}>Scene {String(i + 1).padStart(2, '0')}{s.purpose ? ` · ${purposeLabels[s.purpose]}` : ''}</strong><span>{s.seconds}s · v{s.version}{s.locked ? ' · locked' : ''}</span></div>
        <div className="scene-frame">
          {st.frame ? <PrivateMedia asset={st.frame} alt={`${s.title} storyboard frame`} className="frame-media"/> : <div className="frame-empty"><MediaPlaceholder small label=""/><span>{st.frames ? 'Earlier frames no longer match this scene' : 'No frame yet'}</span></div>}
          {st.approved && <span className="frame-tag"><Check size={12}/>Approved frame</span>}
        </div>
        <div className="scene-card-body">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <label className="sr-only" htmlFor={'title-' + s.id}>Scene {i + 1} title</label>
            <input id={'title-' + s.id} className="title-input" value={s.title} maxLength={120} disabled={s.locked} onChange={e => run(() => updateScene(p, s.id, { title: e.target.value }))}/>
            <button className="icon-button" onClick={() => run(() => toggleLock(p, s.id))} aria-pressed={s.locked} aria-label={s.locked ? `Unlock ${s.title}` : `Lock ${s.title}`} title={s.locked ? 'Locked: protected from edits and redraws' : 'Lock this scene'}>{s.locked ? <Lock size={16}/> : <LockOpen size={16}/>}</button>
          </div>
          <div className="scene-controls">
            <label htmlFor={'purpose-' + s.id}>Purpose<select id={'purpose-' + s.id} value={s.purpose ?? ''} disabled={s.locked} onChange={e => run(() => updateScene(p, s.id, { purpose: (e.target.value || undefined) as ScenePurpose | undefined }))}><option value="">Not set</option>{scenePurposes.map(k => <option key={k} value={k}>{purposeLabels[k]}</option>)}</select></label>
            <label htmlFor={'secs-' + s.id}>Length<select id={'secs-' + s.id} value={s.seconds} disabled={s.locked} onChange={e => run(() => updateScene(p, s.id, { seconds: Number(e.target.value) }))}>{[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} s</option>)}</select></label>
          </div>
          <label className="field-label" htmlFor={'prompt-' + s.id}>What we see</label>
          <textarea id={'prompt-' + s.id} value={s.prompt} maxLength={4000} disabled={s.locked || actions.busy} onChange={e => run(() => updateScene(p, s.id, { prompt: e.target.value }))}/>
          <label className="field-label" htmlFor={'action-' + s.id}>Product action</label>
          <input id={'action-' + s.id} value={s.productAction ?? ''} maxLength={500} placeholder="e.g. Cap twists off, one drop falls" disabled={s.locked || actions.busy} onChange={e => run(() => updateScene(p, s.id, { productAction: e.target.value }))}/>
          {roles.length > 0 && <fieldset className="scene-roles"><legend>Characters in this scene</legend>{roles.map(r => <label key={r.id} className="check-label"><input type="checkbox" disabled={s.locked} checked={s.roleIds.includes(r.id)} onChange={e => run(() => updateScene(p, s.id, { roleIds: e.target.checked ? [...s.roleIds, r.id] : s.roleIds.filter(x => x !== r.id) }))}/>{r.description}</label>)}</fieldset>}
          <p className={'scene-state ' + (st.approved ? 'ok' : st.approvalStale ? 'warn' : '')}>{st.approved ? <><Check size={14}/>Approved{st.clip ? ' · clip current' : st.clipStale ? ' · clip needs regenerating' : ''}</> : st.approvalStale ? <><AlertTriangle size={14}/>Changed since approval — review a new frame</> : st.frame ? 'Ready for your approval' : 'Create a frame to approve'}</p>
          {st.frame && !st.approved && needsProductCheck && <>
            <details className="frame-compare" onToggle={e => { const open = e.currentTarget.open; setComparing(c => ({ ...c, [s.id]: open })); }}><summary>Compare with your product photos</summary>{comparing[s.id] && <ProductReference project={p} compact/>}</details>
            <label className="check-label product-ok"><input type="checkbox" checked={checked[s.id] === st.frame.id} onChange={e => setChecked(c => ({ ...c, [s.id]: e.target.checked ? st.frame!.id : '' }))}/>The product matches my photos: shape, colour and packaging</label>
          </>}
          <div className="scene-card-actions">
            <button className={'button ' + (st.approved ? 'subtle' : 'primary')} disabled={actions.busy || !st.frame || st.approved || !productOk} onClick={() => st.frame && void actions.approve(s.id, st.frame.id)}><Check size={14}/>{st.approved ? 'Approved' : 'Approve frame'}</button>
            <button className="button secondary" onClick={() => actions.requestQuote('frame', s.id)} disabled={actions.busy || s.locked}><RefreshCw size={14}/>{st.frame ? 'Redraw' : 'Create'} frame{pricing ? ` · ${pricing.frame} cr` : ''}</button>
            {p.scenes.length > 1 && <button className="icon-button" onClick={() => run(() => removeScene(p, s.id))} disabled={s.locked || actions.busy} aria-label={`Remove ${s.title}`}><Trash2 size={16}/></button>}
          </div>
          {s.history.length > 0 && <details className="history"><summary>Version history · {s.history.length} earlier version{s.history.length > 1 ? 's' : ''}{st.frames > 1 ? ` · ${st.frames} frames made` : ''}</summary><ol>{[...s.history].reverse().slice(0, 8).map(h => <li key={h.version + h.at}><strong>v{h.version}</strong> · {h.seconds}s — {h.prompt}{h.productAction ? <em> Product: {h.productAction}</em> : null}</li>)}</ol></details>}
        </div>
      </article>;
    })}</div>
    <div className="panel" style={{ marginTop: 24 }}><h3>What changes from the reference?</h3><p style={{ marginTop: 8 }}>{p.brief.differences || 'Add the new creative expression in your brief: compositions, story, copy and original identities.'}</p>
      <p className="small-text muted" style={{ marginTop: 12 }}>Changing what a scene shows, its length, product action or characters affects only that scene’s frame, approval and clip, plus the final assembly. Title and purpose are labels and keep the work. Undoing an edit restores the earlier frame.</p></div>
  </>;
}
