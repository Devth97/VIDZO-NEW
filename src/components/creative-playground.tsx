'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, AudioLines, Focus, MoveUpRight, Sparkles } from 'lucide-react';
import { SilentVideo } from './silent-video';
import { ParticleTitle } from './effects/particle-title';
import { saveDraftIntent } from '@/lib/draft-intent';
import { BorderBeam } from './magic/border-beam';

const directions = [
  { id: 'headphone-detail', label: 'The detail', Icon: Focus, product: 'Silver headphones', title: 'Let the details do the talking.', note: 'A close-up can say more than a long introduction. Give texture, shape and light a moment of their own.', beats: ['Start impossibly close', 'Let the product come into view', 'End on one clear benefit'], brief: 'Create an original 15-second vertical headphones ad. Open with a macro detail, reveal the full headphones, then finish with one approved product benefit. Sculpted light, restrained camera movement and a clean final frame.' },
  { id: 'cat-bed', label: 'The transformation', Icon: MoveUpRight, product: 'Wall-mounted cat bed', title: 'Open with a little contrast.', note: 'A familiar frustration becomes the setup. The product arrives as the satisfying turn in the story.', beats: ['Show the everyday frustration', 'Introduce the product in use', 'Give the payoff room to land'], brief: 'Create an original 15-second vertical cat-bed ad. Show a familiar pet-bed frustration, introduce a wall-mounted cat bed in use, and end on the comfortable final setup. Natural home light, a playful tone and approved product claims.' },
  { id: 'checkered-mug', label: 'The everyday moment', Icon: AudioLines, product: 'Checkered ceramic mug', title: 'Make an ordinary moment memorable.', note: 'Start with a ritual your viewer recognizes. Bring the product into the scene with a human, lived-in point of view.', beats: ['Start with an everyday ritual', 'Bring the product into the moment', 'Close on its distinctive detail'], brief: 'Create an original 15-second vertical ad for a checkered ceramic mug. Open on an everyday coffee ritual, introduce the mug naturally, and close on the checkered finish and pink interior. Candid home setting and an inviting, conversational tone.' },
];

export function CreativePlayground() {
  const id = useId(), router = useRouter();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const direction = directions[index];
  function start() {
    if (!saveDraftIntent({ name: direction.title.replace(/\.$/, ''), objective: 'Product launch', brand: '', product: direction.product, direction: direction.brief })) {
      setError('Your browser could not keep this brief. Enable site storage and try again.');
      return;
    }
    setOpening(true);
    router.push('/projects?new=1');
  }
  return <section className="editorial-section creative-playground" id="creative-playground" aria-labelledby={id + '-title'}>
    <div className="playground-intro"><p className="eyebrow"><Sparkles size={14} aria-hidden="true"/>Creative playground</p><h2 className="playground-particle-heading" id={id + '-title'}><span>Make it yours.</span><ParticleTitle text="Make it yours."/></h2><p>A different opening changes the whole story.<br/>Explore three references, then take a direction into your own brief.</p></div>
    <div className="playground-board" onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`); event.currentTarget.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`); }}>
      <BorderBeam duration={12}/>
      <div className="playground-copy">
        <div className="playground-directions" role="group" aria-label="Choose an opening direction">{directions.map(({ label, Icon }, option) => <button key={label} type="button" aria-pressed={index === option} onClick={() => { setIndex(option); setError(''); }}><Icon size={16} aria-hidden="true"/>{label}</button>)}</div>
        <div className="playground-direction-copy" key={direction.id}>
          <span className="playground-slug">0{index + 1} / THE OPENING</span><h3>{direction.title}</h3><p>{direction.note}</p>
          <ol className="playground-beats">{direction.beats.map((beat, beatIndex) => <li key={beat}><span>0{beatIndex + 1}</span>{beat}</li>)}</ol>
        </div>
        <button className="button primary shimmer" onClick={start} disabled={opening}>{opening ? 'Opening…' : 'Use this direction'}<ArrowUpRight size={17} aria-hidden="true"/></button>
        <small>Starts an editable draft. Generation is quoted separately.</small>{error && <p role="alert">{error}</p>}
      </div>
      <div className="playground-visual">
        <div className="playground-orbits" aria-hidden="true"><span/><span/><i/><i/></div>
        <div className="playground-format-tag">9:16 <span>REFERENCE CLIP</span></div>
        <div className="playground-film" key={direction.id}><SilentVideo id={direction.id}/><span className="playground-film-corner" aria-hidden="true"/><span className="playground-film-number">0{index + 1}</span></div>
        <div className="playground-caption"><span className="playground-caption-dot"/><span>{direction.product}<small>Supplied reference · Silent loop</small></span></div>
      </div>
    </div>
    <p className="playground-footnote">Reference footage, not VIDZO-generated results. Your draft uses the written direction; upload your own authorized reference in the studio.</p>
  </section>;
}
