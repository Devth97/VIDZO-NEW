'use client';
import { useState } from 'react';
import { Check, Download, ShieldCheck, Sparkles, AlertTriangle, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { useWorkspace } from '../workspace-provider';
import { ErrorMessage, MediaPlaceholder } from '../ui';
import { allClipsCurrent, currentExport, deliveryTarget, sceneState, totalSeconds, upscaleDisclosure } from '@/lib/domain/project';
import type { Tier } from '@/lib/domain/schema';
import { JobStatus, PrivateMedia, type StepProps } from './shared';
import { purposeLabels } from './storyboard-step';
export { StoryboardStep } from './storyboard-step';

export function GenerateStep({ project: p, actions, tier, setTier }: StepProps & { tier: Tier; setTier: (t: Tier) => void }) {
  const { pricing, wallet } = useWorkspace();
  const states = p.scenes.map(s => sceneState(p, s));
  const needs = p.scenes.filter((_, i) => !states[i].clip);
  const secs = needs.reduce((n, s) => n + s.seconds, 0);
  const native = pricing?.nativeResolution[tier];
  return <div className="studio-columns"><div>
    <div className="tier-grid">{(['professional', 'premium'] as const).map(t => <label key={t} className={'tier-card ' + (tier === t ? 'selected' : '')}>
      <div><span className="badge">{t === 'professional' ? 'Product-focused' : 'Complex motion'}</span><input type="radio" name="tier" checked={tier === t} onChange={() => setTier(t)}/></div>
      <h3>{t === 'professional' ? 'Professional' : 'Premium'}</h3>
      <p>{t === 'professional' ? 'Clean product scenes from a benchmarked production model.' : 'Specialist models for demanding motion and interactions.'}</p>
      <strong>{pricing ? `${pricing.perSecond[t]} credits / second` : 'Pricing not configured'}</strong>
      <small className="muted">{pricing ? `${secs ? `Up to ${secs * pricing.perSecond[t]} credits for the ${secs} s still needed` : 'All clips are current'}${pricing.illustrative ? ' · placeholder rate' : ''}` : 'Quotes unavailable until pricing is set'}</small></label>)}</div>
    {actions.job && <JobStatus job={actions.job} project={p} onRetry={actions.retry}/>}
    <dl className="wallet-strip" aria-label="Your credits">
      <div><dt>Available</dt><dd>{wallet.available}</dd></div>
      <div><dt>Held for running work</dt><dd>{wallet.held}</dd></div>
      <div><dt>Spent</dt><dd>{wallet.spent}</dd></div>
    </dl>
    <section className="panel"><h3>A clear quote. A confident decision.</h3>
      <dl style={{ marginTop: 16 }}>
        <div className="quote-detail"><dt>Scenes to generate</dt><dd>{needs.length ? `${needs.length} of ${p.scenes.length} (${secs} s)` : 'None — all current'}</dd></div>
        <div className="quote-detail"><dt>Finished ad</dt><dd>{totalSeconds(p)} s · 9:16 · {p.scenes.length} scene{p.scenes.length === 1 ? '' : 's'}</dd></div>
        <div className="quote-detail"><dt>Delivery target</dt><dd>{deliveryTarget.label}</dd></div>
        <div className="quote-detail"><dt>Native resolution</dt><dd>{native ?? 'Disclosed with the quote'}</dd></div>
        <div className="quote-detail"><dt>Technical failures</dt><dd>Retried free, then released</dd></div>
        <div className="quote-detail"><dt>Quality concerns</dt><dd>Reviewed before any paid redraw</dd></div>
        <div className="quote-detail"><dt>Creative revisions</dt><dd>Separate quote, with consent</dd></div>
      </dl>
      {native && <p className="small-text muted" style={{ marginTop: 12 }}>{upscaleDisclosure(native)}</p>}
      <p className="small-text muted" style={{ margin: '16px 0 20px' }}>No subscription. The quote shows the maximum before anything is held. Scenes that already have a current clip are not regenerated.</p>
      <button className="button primary full" disabled={actions.busy || !needs.length} onClick={() => actions.requestQuote('video')}><Sparkles size={17}/>Review generation quote</button>
    </section>
    <section className="panel" style={{ marginTop: 24 }}><h3>Review by scene</h3>
      {p.scenes.map((s, i) => <div key={s.id} className="clip-row"><div><strong>Scene {i + 1} · {s.title}</strong><small className="muted">{s.purpose ? `${purposeLabels[s.purpose]} · ` : ''}{s.seconds}s · {states[i].clip ? 'Clip current' : states[i].clipStale ? 'Earlier clip no longer matches' : 'Not generated'}</small></div>
        {states[i].clip && <PrivateMedia asset={states[i].clip} alt={`Scene ${i + 1} clip`} className="clip-media"/>}
        {states[i].clip && <button className="text-button" onClick={() => actions.requestQuote('scene', s.id)} disabled={actions.busy}>Quote a creative revision{pricing ? ` · up to ${s.seconds * pricing.perSecond[tier]} cr` : ''}</button>}</div>)}
      <p className="small-text muted" style={{ marginTop: 12 }}>A wrong product or broken clip is a quality concern, not a revision: <Link className="text-button" href="/support">report it for review</Link> before paying for a redraw.</p>
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
      {actions.job && <JobStatus job={actions.job} project={p} onRetry={actions.retry}/>}
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
