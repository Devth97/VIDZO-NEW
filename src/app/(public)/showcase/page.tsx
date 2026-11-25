import { CreationComposer } from '@/components/creation-composer';
export const metadata = { title: 'Starting points' };
export default function Showcase() {
  return <div className="editorial-home starting-page"><header><p className="eyebrow">STARTING POINTS</p><h1>Give your next ad a job.</h1><p>Pick a quick start to fill in a project name and goal. Then add your own reference, product and brief.</p></header><CreationComposer variant="hero"/><section className="starting-notes" aria-labelledby="starting-notes-title"><h2 id="starting-notes-title">A starting point, not a finished ad.</h2><p>These shortcuts set up a draft. They do not generate content or spend credits. Your creative direction takes shape in the studio, with your own materials and approvals.</p><p>Published customer videos will appear only with permission. There are no public customer results yet.</p></section></div>;
}
