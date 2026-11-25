import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ConceptGallery } from '@/components/concept-gallery';
export const metadata = { title: 'Creative directions' };
export default function Showcase() {
  return <div className="editorial-home"><section className="editorial-section concept-page"><p className="eyebrow">THE DIRECTION BOARD</p><h1>A starting point.<br/><em>Never a template.</em></h1><p className="lead muted">Explore light, texture and composition. Then bring your own product and a reference you have permission to use.</p><ConceptGallery/><div className="concept-footnote"><div><h2>Customer work comes with permission.</h2><p className="muted">There are no published customer videos yet. These original concept stills illustrate art direction, not VIDZO video output.</p></div><Link className="button primary" href="/projects?new=1">Start your own draft<ArrowRight size={17}/></Link></div></section></div>;
}
