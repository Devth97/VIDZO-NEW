'use client';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { placeholderPricing } from '@/lib/domain/pricing';
import { rupees } from '@/lib/domain/schema';

export default function PricingPage() {
  const { pricing } = useWorkspace();
  const pr = pricing ?? placeholderPricing;
  const example = { secs: 12, frames: 3 };
  const exampleCredits = example.frames * pr.frame + example.secs * pr.perSecond.professional + pr.export;
  return <div className="landing editorial-pricing">
    <section className="public-section first">
      <p className="eyebrow">PRICING</p>
      <h1 className="page-title">Prepaid credits. A quote before every spend.</h1>
      <p className="muted lead">No compulsory subscription. You see the maximum credits, model and native resolution before you confirm, and only finished work is settled.</p>
      <div className="pricing-draft"><span><strong>Start with the idea. Decide on credits later.</strong><small>Create your project draft at no cost. AI generation is quoted separately.</small></span><Link className="button primary" href="/projects?new=1">Start a free draft<ArrowRight size={16}/></Link></div>
      {pr.illustrative && <p className="notice warning" style={{ marginTop: 24 }}>Pilot pricing under validation. Credit rates are placeholders until production costs are measured; they may change before launch. Explore mode never charges money.</p>}
      <div className="grid-two packs">{pr.packs.map((p, i) => <article key={p.id} className={'panel pack-card' + (i === 0 ? ' featured' : '')}>
        <p className="eyebrow">{i === 0 ? 'FOR YOUR FIRST CONCEPT' : 'FOR MORE CREATIVE EXPLORATION'}</p><h3>{p.id === 'starter' ? 'Starter' : p.id === 'studio' ? 'Studio' : p.id}</h3>
        <p className="pack-price">{rupees(p.paise / 100)} <span>· {p.credits} credits</span></p>
        <p className="small-text muted">{rupees(p.paise / 100 / p.credits)} per credit · prices in INR; taxes shown at checkout</p>
        <ul className="check-list"><li><Check size={15}/>Credits do not expire during the beta</li><li><Check size={15}/>Use for frames, identity sheets, clips and assembly</li><li><Check size={15}/>Purchase history and ledger in your wallet</li></ul>
        <Link className={'button ' + (i === 0 ? 'primary' : 'secondary') + ' full'} href="/wallet">{pr.illustrative ? 'View wallet & availability' : `Choose ${p.credits} credits`}<ArrowRight size={16}/></Link></article>)}</div>
    </section>
    <section className="public-section"><h2>What things cost</h2>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Credit rates, scroll horizontally on smaller screens"><table className="price-table"><caption className="sr-only">Credit rates</caption><thead><tr><th scope="col">Work</th><th scope="col">Credits</th><th scope="col">When it is charged</th></tr></thead><tbody>
        <tr><td>Reference analysis</td><td>Free · one per day</td><td>Never</td></tr>
        <tr><td>Storyboard frame (per scene)</td><td>{pr.frame}</td><td>When the frame is delivered</td></tr>
        <tr><td>Identity sheet (four views)</td><td>{pr.characterSheet}</td><td>When the sheet is delivered</td></tr>
        <tr><td>Professional video</td><td>{pr.perSecond.professional} per second</td><td>Per finished clip</td></tr>
        <tr><td>Premium video</td><td>{pr.perSecond.premium} per second</td><td>Per finished clip</td></tr>
        <tr><td>Final assembly (1080×1920, logo + CTA overlay)</td><td>{pr.export || 'Included'}</td><td>When assembled</td></tr>
      </tbody></table></div>
      <div className="panel example-quote"><h3>Example quote</h3><p className="muted small-text">A product-only 12-second Professional ad with three scenes: {example.frames} frames × {pr.frame} + {example.secs} s × {pr.perSecond.professional} + assembly = <strong>{exampleCredits} credits</strong> (≈ {rupees((exampleCredits * pr.creditValuePaise) / 100)}). Redraws you request are quoted separately.</p></div>
    </section>
    <section className="public-section" id="refunds"><h2>Refunds and failures</h2>
      <ul className="check-list wide"><li><Check size={15}/>Credits are held during a job; technical failures release unsettled credits automatically.</li><li><Check size={15}/>Invalid or corrupt uploads are rejected without any charge.</li><li><Check size={15}/>Quality concerns go to human review before any paid redraw.</li><li><Check size={15}/>A failed or pending payment never adds credits; credits appear only after the payment provider confirms capture.</li><li><Check size={15}/>Refunds of unused purchased credits follow the published refund policy (pending legal review before paid launch).</li></ul>
    </section>
  </div>;
}
