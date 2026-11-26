import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ScanLine, Layers3, Film, ShieldCheck, Receipt, Undo2 } from 'lucide-react';
import { StudioBoard } from '@/components/studio-board';
import { CreativeWorkspace } from '@/components/creative-workspace';
import { placeholderPricing } from '@/lib/domain/pricing';
import { rupees } from '@/lib/domain/schema';

/** Status reflects what works today: drafting and storyboards are live; video generation opens with live services. */
const steps = [
  { Icon: ScanLine, title: 'Bring the spark', body: 'Upload an authorized reference. Identify the hook, pacing and shots worth exploring.', status: 'Available now', live: true },
  { Icon: Layers3, title: 'Make it unmistakably yours', body: 'Add your product, brand and brief. Choose characters when needed, then shape each scene.', status: 'Available now', live: true },
  { Icon: Film, title: 'Approve, then produce', body: 'Approve every storyboard frame and the credit quote. Then produce the video, scene by scene.', status: 'Video opens with live services', live: false },
];

const faqs = [
  ['What can I try for free?', 'Creating an account and a project draft is free. AI generation is separate: you see a credit quote before approving paid work. Live generation and purchases are being prepared for the beta.'],
  ['Can I use any ad as a reference?', 'Use a reference you own or have permission to use. Develop a distinct concept with your product and original expression. Changing a character alone does not clear copyright.'],
  ['Can I generate a finished video yet?', 'Drafts and private workspaces are available. Live generation and purchases are being prepared for the beta. You will review the storyboard and a credit quote before approving paid production.'],
  ['How do credits work?', 'Credits are prepaid. Before generation, the quote identifies the model, native resolution, maximum credits and expiry. Nothing is held until you confirm. Pilot prices remain provisional until provider costs are measured.'],
  ['What if a generation fails?', 'Technical failures release unsettled credits. Quality concerns go to review before a paid redraw. Duplicate clicks do not create duplicate charges.'],
  ['Who controls my product and brand?', 'You supply product photos, your exact logo and approved claims. Review the storyboard and quote before video production. Human quality review is part of the planned beta delivery process.'],
] as const;

export default function Home() {
  const pack = placeholderPricing.packs[0];
  return <div className="editorial-home workspace-home">
    <CreativeWorkspace/>
    <div className="promise-strip"><span>Made for brand builders</span><p><ShieldCheck size={17}/>Your direction stays yours</p><p><Receipt size={17}/>A quote before you spend</p><p><Undo2 size={17}/>Redo a scene, not the whole story</p></div>
    <StudioBoard/>
    <section className="editorial-section playful-steps" id="how"><div className="playful-head"><p className="eyebrow">How the studio works</p><h2>Reference. Direction.<br/><em>Review.</em></h2><p>Keep the reference, product, brief and scene decisions together in one project. Nothing is generated until you approve a quote.</p></div>
      <ol className="step-cards">{steps.map(({ Icon, title, body, status, live }, i) => <li key={title}><span className="step-no">0{i + 1}</span><Icon size={22} strokeWidth={1.5} aria-hidden="true"/><h3>{title}</h3><p>{body}</p><span className={'status-pill' + (live ? '' : ' is-planned')}>{status}</span></li>)}</ol>
      <p className="playful-center"><Link className="button secondary" href="/projects?new=1">Start with a draft<ArrowRight size={16}/></Link></p>
    </section>
    <section className="editorial-section price-preview"><div><p className="eyebrow">Good creative, clear costs</p><h2>Know the next step.<br/><em>And what it costs.</em></h2><p>Create your draft first. Generation starts with your approval of a quote, including the model, resolution and maximum credits.</p><Link className="editorial-link" href="/pricing">Understand the credits<ArrowUpRight size={17}/></Link></div><div className="price-preview-card"><span className="eyebrow">Illustrative starter pack</span><p className="preview-price">{rupees(pack.paise / 100)}<span>/ {pack.credits} credits</span></p><hr/><p><Check size={15}/>Prepaid credits, no compulsory subscription</p><p><Check size={15}/>Technical failures release unsettled credits</p><p className="small-text muted">Pilot pricing under validation. Purchases and generation open when live services are ready.</p><Link className="button secondary full" href="/pricing">See pricing details<ArrowRight size={16}/></Link></div></section>
    <section className="editorial-section editorial-faq" id="faq"><div><p className="eyebrow">Before your first draft</p><h2>A few good<br/><em>questions.</em></h2></div><div className="faq">{faqs.map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
    <section className="editorial-final"><div><p className="eyebrow">Private beta</p><h2>Ready to make it <em>yours?</em></h2><p>Free to draft · No card needed · Quote before generation</p></div><Link className="button primary" href="#new-draft">Create your draft<ArrowRight size={18}/></Link></section>
  </div>;
}
