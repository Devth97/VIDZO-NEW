import Link from 'next/link';
import { Film } from 'lucide-react';

export const metadata = { title: 'Showcase' };
const industries = ['Beauty', 'Apparel', 'Electronics', 'Jewelry', 'Packaged goods'];

/** Only genuine, permitted outputs may appear here. None exist yet, so the page says so. */
export default function Showcase() {
  return <div className="landing"><section className="public-section first">
    <p className="eyebrow">SHOWCASE</p><h1 className="page-title">Real work, shown with permission.</h1>
    <p className="muted lead">This page will only show actual VIDZO outputs that customers have allowed us to publish, each with its reference concept, the model tier and any upscaling disclosed.</p>
    <div className="segmented" role="group" aria-label="Filter by industry" style={{ marginTop: 28 }}>{['All', ...industries].map((x, i) => <button key={x} aria-pressed={i === 0} className={i === 0 ? 'active' : ''} disabled={i !== 0}>{x}</button>)}</div>
    <div className="empty-state panel" style={{ marginTop: 28 }}><Film size={30}/><h2>No published work yet</h2><p>We are in beta and have not published customer work. We will not fill this page with stock footage or invented examples.</p><Link className="button primary" href="/projects">Try the workflow with a sample</Link></div>
  </section></div>;
}
