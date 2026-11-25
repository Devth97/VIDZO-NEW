import Link from 'next/link';
import { ArrowRight, Check, ScanLine, Users, Film, ShieldCheck, Receipt, Undo2 } from 'lucide-react';
import { ProductArt } from '@/components/ui';
import { placeholderPricing } from '@/lib/domain/pricing';
import { rupees } from '@/lib/domain/schema';

const faqs = [
  ['Can I use any ad I find as a reference?', 'Only references you own or have permission to use. We study the concept (pacing, shot types, the hook) and help you create new expression with your own product and original characters. Changing a character alone does not clear copyright, so you confirm rights before uploading and review the result before delivery.'],
  ['Will the ad look like my real product?', 'You upload your own product photos and exact logo. The logo and call to action are added as exact overlays, not redrawn by a model. A person on our team checks product fidelity, likeness and claims before any export can be downloaded during the beta.'],
  ['How much does it cost?', 'You buy prepaid credits. Before any generation you see a quote with the model, native resolution, maximum credits and expiry, and nothing is held until you confirm. Credits are held while work runs and only finished items are settled.'],
  ['What happens if generation fails?', 'Technical failures release the unsettled credits automatically. If you are unhappy with quality, contact support first: quality concerns go to review before any paid redraw.'],
  ['Do you guarantee results?', 'No. We do not promise virality, views or return on ad spend, and we do not invent examples. The showcase only shows work we are allowed to publish.'],
  ['Where are my files stored?', 'In private storage, accessible through short-lived signed links only. Uploads are never used in a public gallery or in analytics.'],
] as const;

export default function Home() {
  const pack = placeholderPricing.packs[0];
  return <div className="landing">
    <section className="landing-hero">
      <div className="hero-copy">
        <p className="eyebrow">THE REFERENCE-TO-ORIGINAL AD STUDIO · BETA</p>
        <h1>Proven concepts. Your brand. <em>Reimagined.</em></h1>
        <p>Start from an ad concept you are allowed to use. Make a distinct 10–15 second vertical ad with your real product, your exact logo and original characters — approving every frame before you spend.</p>
        <div className="inline-actions"><Link className="button ink large" href="/projects">Create your first ad<ArrowRight size={18}/></Link><Link className="text-button" href="/pricing">See how credits work</Link></div>
        <ul className="hero-points"><li><Check size={15}/>Drafts and storyboards before any video spend</li><li><Check size={15}/>Quote shown upfront · no subscription</li><li><Check size={15}/>Failed generations release their credits</li></ul>
      </div>
      <div className="landing-visual"><ProductArt/><div className="visual-label"><span>ILLUSTRATION · NOT A GENERATED AD</span><span>9:16</span></div></div>
    </section>

    <section className="public-section" id="how">
      <p className="eyebrow">HOW IT WORKS</p>
      <h2>Three decisions. You make every one.</h2>
      <div className="feature-grid">
        <article><ScanLine size={22}/><h3>1 · Bring a reference</h3><p>Upload an authorized 5–30 s MP4 or MOV. We verify the file, then break down the hook, shots, roles and call to action. Edit anything we got wrong.</p></article>
        <article><Users size={22}/><h3>2 · Make it yours</h3><p>Pick original identities from four-view sheets, add product photos, logo and brief, and approve a frame for every scene. Only what you change is redone.</p></article>
        <article><Film size={22}/><h3>3 · Approve, then produce</h3><p>Choose Professional or Premium, read the quote, confirm. Watch real job stages, review each clip, and download after a human quality check.</p></article>
      </div>
    </section>

    <section className="public-section">
      <p className="eyebrow">WHY TEAMS TRUST THE PROCESS</p>
      <h2>No surprises between the idea and the invoice.</h2>
      <div className="feature-grid">
        <article><Receipt size={22}/><h3>Upfront quotes</h3><p>Model, native resolution, maximum credits and expiry before consent. If the project changes, the quote is void and you get a new one.</p></article>
        <article><Undo2 size={22}/><h3>Fair failure handling</h3><p>Duplicate clicks never double-charge. Technical failures release held credits. Unknown provider outcomes are reconciled, never blindly re-run.</p></article>
        <article><ShieldCheck size={22}/><h3>Rights and review</h3><p>Rights confirmation, no identification of real people, exact logo overlays, no reference audio, and human review of product, likeness and claims.</p></article>
      </div>
    </section>

    <section className="public-section cta-band">
      <div><h2>Try the whole workflow first.</h2><p className="muted">Explore a sample project end to end with simulated credits. When you are ready, a starter pack is {pack.credits} credits for {rupees(pack.paise / 100)} <span className="small-text">(pilot price, subject to change)</span>.</p></div>
      <Link className="button primary large" href="/projects">Create your first ad<ArrowRight size={18}/></Link>
    </section>

    <section className="public-section" id="faq"><p className="eyebrow">QUESTIONS, ANSWERED HONESTLY</p><h2>Before you start</h2>
      <div className="faq">{faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
  </div>;
}
