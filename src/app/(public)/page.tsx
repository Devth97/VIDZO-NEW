import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ScanLine, Layers3, Film, ShieldCheck, Receipt, Undo2 } from 'lucide-react';
import { ConceptGallery } from '@/components/concept-gallery';
import { CreationComposer } from '@/components/creation-composer';
import { placeholderPricing } from '@/lib/domain/pricing';
import { rupees } from '@/lib/domain/schema';

const faqs = [
  ['What can I try for free?', 'Creating an account and a project draft is free. AI generation is separate: you see a credit quote before approving paid work. Live generation and purchases are being prepared for the beta.'],
  ['Can I use any ad as a reference?', 'Use a reference you own or have permission to use. Develop a distinct concept with your product and original expression. Changing a character alone does not clear copyright.'],
  ['Are these actual VIDZO videos?', 'The visuals on this page are AI-created concept stills, not finished videos or customer results. Published customer work will appear only with permission.'],
  ['How do credits work?', 'Credits are prepaid. Before generation, the quote identifies the model, native resolution, maximum credits and expiry. Nothing is held until you confirm. Pilot prices remain provisional until provider costs are measured.'],
  ['What if a generation fails?', 'Technical failures release unsettled credits. Quality concerns go to review before a paid redraw. Duplicate clicks do not create duplicate charges.'],
  ['Who controls my product and brand?', 'You supply product photos, your exact logo and approved claims. Review the storyboard and quote before video production. Human quality review is part of the planned beta delivery process.'],
] as const;

export default function Home() {
  const pack = placeholderPricing.packs[0];
  return <div className="editorial-home">
    <section className="create-hero" aria-labelledby="hero-title">
      <p className="eyebrow"><span className="status-dot"/>PRIVATE BETA · ORIGINAL PRODUCT ADS</p>
      <h1 id="hero-title">Good inspiration.<br/>Distinctly <em>your ad.</em></h1>
      <p className="hero-description">Start from a reference you have permission to use. Bring your real product. Approve every scene, then the quote.</p>
      <CreationComposer variant="hero"/>
      <p className="hero-reassurance"><Check size={15}/>Free to draft · no card needed · generation is quoted separately</p>
    </section>
    <section className="discover-strip" aria-labelledby="discover-title">
      <div className="discover-head"><h2 id="discover-title">Need a direction?</h2><Link className="editorial-link" href="/showcase">See all creative directions<ArrowUpRight size={16}/></Link></div>
      <ConceptGallery compact/>
    </section>
    <div className="promise-strip"><span>MADE FOR BRAND BUILDERS</span><p><ShieldCheck size={17}/>Your direction stays yours</p><p><Receipt size={17}/>A quote before you spend</p><p><Undo2 size={17}/>Redo a scene, not the whole story</p></div>
    <section className="editorial-section method-section" id="how"><div className="method-heading"><p className="eyebrow">LESS GUESSWORK. MORE DIRECTION.</p><h2>From “I like that”<br/>to <em>“that feels like us.”</em></h2><p>You steer the story. VIDZO gives each decision a place, from the first reference to the final review.</p><Link className="editorial-link" href="/projects?new=1">Start with a draft<ArrowRight size={17}/></Link></div><div className="method-steps">
      {[{icon:ScanLine, title:'Bring the spark.', body:'Start with an authorized reference. Identify the hook, pacing and shots worth exploring.', meta:'01 / REFERENCE'}, {icon:Layers3, title:'Make it unmistakably yours.', body:'Add your product, brand and brief. Choose characters when needed, then review each scene.', meta:'02 / CREATIVE DIRECTION'}, {icon:Film, title:'Approve the next move.', body:'Review the storyboard and credit quote before video production. Keep control of individual scenes.', meta:'03 / REVIEW & PRODUCE'}].map(({icon:Icon,title,body,meta}) => <article key={meta}><span className="method-number">{meta}</span><div><Icon size={22} strokeWidth={1.5}/><h3>{title}</h3><p>{body}</p></div></article>)}
    </div></section>
    <section className="editorial-section price-preview"><div><p className="eyebrow">GOOD CREATIVE. CLEAR COSTS.</p><h2>Know the next step.<br/><em>And what it costs.</em></h2><p>Create your draft first. Generation starts with your approval of a quote, including the model, resolution and maximum credits.</p><Link className="editorial-link" href="/pricing">Understand the credits<ArrowUpRight size={17}/></Link></div><div className="price-preview-card"><span className="eyebrow">ILLUSTRATIVE STARTER PACK</span><p className="preview-price">{rupees(pack.paise / 100)}<span>/ {pack.credits} credits</span></p><hr/><p><Check size={15}/>Prepaid credits, no compulsory subscription</p><p><Check size={15}/>Technical failures release unsettled credits</p><p className="small-text muted">Pilot pricing under validation. Purchases and generation open when live services are ready.</p><Link className="button secondary full" href="/pricing">See pricing details<ArrowRight size={16}/></Link></div></section>
    <section className="editorial-section editorial-faq" id="faq"><div><p className="eyebrow">BEFORE YOUR FIRST DRAFT</p><h2>A few good<br/><em>questions.</em></h2></div><div className="faq">{faqs.map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
    <section className="editorial-final"><p className="eyebrow">THE NEXT IDEA IS YOURS.</p><h2>Make room for<br/><em>something original.</em></h2><Link className="button primary large" href="/projects?new=1">Start a free draft<ArrowRight size={18}/></Link><p>Private beta · No card needed to create a draft</p></section>
  </div>;
}
