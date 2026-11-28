'use client';
import { useState } from 'react';
import { Users, Check, ImagePlus, FileImage, ShieldCheck, History } from 'lucide-react';
import { useWorkspace } from '../workspace-provider';
import { ErrorMessage } from '../ui';
import { currentSheet, fidelityLabels, logoAsset, productAssets, referenceLimits, selectCandidate, sheetHistory } from '@/lib/domain/project';
import type { Brief } from '@/lib/domain/schema';
import { PrivateMedia, type StepProps } from './shared';

export function CharactersStep({ project: p, actions }: StepProps) {
  const { pricing } = useWorkspace();
  const [error, setError] = useState(''), [history, setHistory] = useState<string | null>(null);
  const roles = p.analysis?.roles ?? [];
  if (!roles.length) return <div className="panel empty-state"><Users size={32}/><h3>Let your product do the talking.</h3><p>No character roles are needed for this concept. Continue to your brand and brief, or add roles in Analysis.</p><span className="badge success"><Check size={14}/>Product-only concept</span></div>;
  return <div>
    <div className="notice"><ShieldCheck size={18}/><span>Identity sheets show front, profile, three-quarter and full-body views. We never create a recognisable likeness of a real person without permission.</span></div>
    {roles.map(role => {
      const options = p.candidates.filter(c => c.roleId === role.id);
      const missing = options.filter(c => !currentSheet(p, c.id)).length;
      return <section key={role.id} className="role-section">
        <div className="section-head"><div><h3>{role.description}</h3><p className="muted small-text">Choose one original identity. Earlier versions stay available.</p></div>
          {missing > 0 && <button className="button primary" onClick={() => actions.requestQuote('characters', role.id)} disabled={actions.busy}>Create {missing} identity sheet{missing > 1 ? 's' : ''}{pricing ? ` · ${missing * pricing.characterSheet} credits` : ''}</button>}</div>
        <div className="candidate-grid">{options.map((c, i) => {
          const sheet = currentSheet(p, c.id), versions = sheetHistory(p, c.id), selected = p.selections[role.id] === c.id;
          return <article key={c.id} className={'candidate-card ' + (selected ? 'selected' : '')}>
            <div className="candidate-portrait">{sheet ? <PrivateMedia asset={sheet} alt={`${c.name} identity sheet: front, profile, three-quarter and full body`}/> : <><Users size={56}/><span className="art-caption">Sheet not created yet</span></>}</div>
            <div className="candidate-info">
              <label><input type="radio" name={role.id} checked={selected} disabled={!sheet} onChange={() => { try { actions.change(selectCandidate(p, role.id, c.id, true)); setError(''); } catch (e) { setError((e as Error).message); } }}/>{c.name} · Option {i + 1}</label>
              <p>{c.description}</p>
              <div className="inline-actions"><span className="badge">{sheet ? `Version ${sheet.version ?? versions.length}` : 'No sheet'}</span>
                {versions.length > 1 && <button className="text-button" onClick={() => setHistory(history === c.id ? null : c.id)} aria-expanded={history === c.id}><History size={14}/>{versions.length} versions</button>}
                {sheet && <button className="text-button" onClick={() => actions.requestQuote('character', c.id)} disabled={actions.busy}>Quote a redraw</button>}</div>
              {history === c.id && <div className="version-strip">{versions.map(v => <figure key={v.id}><PrivateMedia asset={v} alt={`${c.name} version ${v.version}`}/><figcaption>v{v.version}{v.id === sheet?.id ? ' · current' : ''}</figcaption></figure>)}</div>}
              {!sheet && <p className="small-text muted">Create the sheet to select this identity.</p>}
            </div>
          </article>;
        })}</div>
      </section>;
    })}
    <ErrorMessage message={error}/>
  </div>;
}

const fidelityHints = { shape: 'e.g. Tall cylinder, rounded shoulders, 30 ml', colour: 'e.g. Frosted amber glass, matte black cap', packaging: 'e.g. Front label text reads exactly as in the photos', prohibited: 'e.g. Never add a dropper, extra text or a second product' } as const;

export function BrandStep({ project: p, actions }: StepProps) {
  const { demo } = useWorkspace();
  const [error, setError] = useState(''), [uploading, setUploading] = useState<string | null>(null);
  const field = (key: keyof Brief, value: string) => actions.change({ ...p, brief: { ...p.brief, [key]: value } });
  const products = productAssets(p), logo = logoAsset(p);
  async function pick(file: File | undefined, kind: 'product' | 'logo') {
    if (!file) return;
    setError(''); setUploading(kind);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use PNG, JPEG or WebP images.');
      if (file.size > referenceLimits.imageMaxBytes) throw new Error('Brand images must be 10 MB or smaller.');
      const asset = await actions.upload(file, kind);
      if (asset?.status === 'rejected') setError(`We couldn’t use ${file.name}: ${asset.rejectReason}`);
    } catch (e) { setError((e as Error).message); } finally { setUploading(null); }
  }
  const rejected = p.assets.filter(a => (a.kind === 'product' || a.kind === 'logo') && a.status === 'rejected');
  return <div className="studio-columns"><div>
    <section className="panel"><h3>Your brand, in the frame.</h3><p className="muted small-text" style={{ margin: '8px 0 24px' }}>Original files are stored unchanged. Add clear angles of one primary product and your exact logo.</p>
      <div className="field-grid"><div className="field"><label htmlFor="brand-name">Brand name</label><input id="brand-name" value={p.brief.brand} maxLength={100} onChange={e => field('brand', e.target.value)}/></div><div className="field"><label htmlFor="product-name">Primary product</label><input id="product-name" value={p.brief.product} maxLength={200} onChange={e => field('product', e.target.value)}/></div></div>
      <div className="field-grid">
        <div className="file-pick"><span className="file-pick-title">Product photos</span><input id="product-upload" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploading)} onChange={e => { void pick(e.target.files?.[0], 'product'); e.target.value = ''; }}/><label htmlFor="product-upload" className="upload-button" aria-disabled={Boolean(uploading)}><ImagePlus size={16}/>{uploading === 'product' ? 'Uploading…' : products.length ? 'Add another angle' : 'Add a product photo'}</label><small>PNG, JPEG or WebP · up to 10 MB</small></div>
        <div className="file-pick"><span className="file-pick-title">Exact logo</span><input id="logo-upload" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploading)} onChange={e => { void pick(e.target.files?.[0], 'logo'); e.target.value = ''; }}/><label htmlFor="logo-upload" className="upload-button" aria-disabled={Boolean(uploading)}><FileImage size={16}/>{uploading === 'logo' ? 'Uploading…' : logo ? 'Replace logo' : 'Add your logo'}</label><small>Transparent PNG recommended</small></div>
      </div>
      {uploading && <p className="small-text muted" role="status">Uploading and verifying your {uploading}…</p>}
      <ErrorMessage message={error}/>
      <div className="thumb-grid">{[...products, ...(logo ? [logo] : [])].map(a => <figure key={a.id}><PrivateMedia asset={a} alt={`${a.kind === 'logo' ? 'Logo' : 'Product photo'}: ${a.name}`}/><figcaption><FileImage size={14}/>{a.kind === 'logo' ? 'Logo' : 'Product'} · {a.width}×{a.height}</figcaption></figure>)}</div>
      {rejected.length > 0 && <p className="small-text muted">{rejected.length} file{rejected.length > 1 ? 's were' : ' was'} rejected during verification and will not be used.</p>}
      {!p.sample && (!products.length || !logo) && <p className="notice warning">Add at least one product photo and your logo before the storyboard.</p>}
      <div className="field-grid" style={{ marginTop: 24 }}><div className="field"><label htmlFor="brand-color">Brand colour</label><input id="brand-color" type="color" value={p.brief.color} onChange={e => field('color', e.target.value)}/></div><div className="field"><label htmlFor="brand-font">Optional font preference</label><input id="brand-font" value={p.brief.font} maxLength={100} placeholder="e.g. Inter" onChange={e => field('font', e.target.value)}/></div></div>
    </section>
    <section className="panel" style={{ marginTop: 24 }} aria-labelledby="fidelity-title"><h3 id="fidelity-title">What must stay exact</h3><p className="muted small-text" style={{ margin: '8px 0 24px' }}>Sent with every frame and clip request, and listed beside each frame when you approve it. Models cannot guarantee a perfect match, so these notes are your review checklist too.</p>
      {(Object.keys(fidelityLabels) as (keyof typeof fidelityLabels)[]).map(k => <div className="field" key={k}><label htmlFor={'fidelity-' + k}>{fidelityLabels[k]} (optional)</label><textarea id={'fidelity-' + k} rows={2} value={p.brief.fidelity?.[k] ?? ''} maxLength={k === 'prohibited' ? 1000 : 500} placeholder={fidelityHints[k]} onChange={e => actions.change({ ...p, brief: { ...p.brief, fidelity: { ...p.brief.fidelity, [k]: e.target.value } } })}/></div>)}
    </section>
    <section className="panel" style={{ marginTop: 24 }}><h3>The creative brief</h3><p className="muted small-text" style={{ margin: '8px 0 24px' }}>A few considered details make a more distinctive ad. Visual details (product, tone, colour, differences) affect frames; text overlays (CTA, offer, claims, font) affect only the final assembly.</p>
      <div className="field-grid"><div className="field"><label htmlFor="objective">Objective</label><select id="objective" value={p.brief.objective} onChange={e => field('objective', e.target.value)}>{['Product launch', 'Brand awareness', 'Offer promotion', 'Product education'].map(v => <option key={v}>{v}</option>)}</select></div><div className="field"><label htmlFor="language">Language</label><select id="language" value={p.brief.language} onChange={e => field('language', e.target.value)}>{['English', 'Hindi', 'Tamil', 'Kannada', 'Telugu', 'Malayalam'].map(v => <option key={v}>{v}</option>)}</select></div></div>
      {([['audience', 'Who is it for?', 'Describe your audience', 1000], ['tone', 'How should it feel?', 'e.g. Warm, understated and confident', 200], ['cta', 'Call to action', 'e.g. Discover the collection', 200], ['offer', 'Offer or website (optional)', 'Entered manually; no website import', 500], ['claims', 'Approved product claims (optional)', 'Only claims you can substantiate', 2000], ['differences', 'What will make this original?', 'New compositions, story, characters and copy', 2000]] as const).map(([key, label, placeholder, max]) => <div className="field" key={key}><label htmlFor={'brief-' + key}>{label}</label>{['audience', 'claims', 'differences'].includes(key) ? <textarea id={'brief-' + key} value={p.brief[key]} placeholder={placeholder} maxLength={max} onChange={e => field(key, e.target.value)}/> : <input id={'brief-' + key} value={p.brief[key]} placeholder={placeholder} maxLength={max} onChange={e => field(key, e.target.value)}/>}</div>)}
    </section></div>
    <aside className="panel studio-aside"><ImagePlus size={24}/><h3 style={{ marginTop: 16 }}>The details make the difference.</h3><ul className="check-list"><li><Check size={15}/>Front, side and detail product angles</li><li><Check size={15}/>A crisp, transparent logo</li><li><Check size={15}/>Your exact material, shape and packaging</li><li><Check size={15}/>A clear, readable call to action</li></ul><hr className="divider"/><p>Your logo is composited as an exact overlay rather than redrawn by a model.</p>{demo && p.sample && <p style={{ marginTop: 12 }} className="small-text muted">The sample can continue without uploads. Real projects need your original product photos.</p>}</aside>
  </div>;
}
