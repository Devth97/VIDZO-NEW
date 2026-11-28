'use client';

import { useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Expand } from 'lucide-react';
import { Modal } from './ui';
import { SilentVideo } from './silent-video';

const clips = [
  { id: 'street-tote', title: 'An everyday bag. An unexpected hook.', label: 'Street-style tote', description: 'A red and white striped tote in a playful street scene.' },
  { id: 'truck-reveal', title: 'Make the reveal the story.', label: 'Unexpected reveal', description: 'A delivery truck opens into a playful oversized product reveal.' },
  { id: 'cat-bed', title: 'A little before. A better after.', label: 'Home upgrade', description: 'A cardboard cat bed gives way to a woven wall-mounted basket.' },
  { id: 'poolside-bag', title: 'Put the product in the moment.', label: 'Poolside carry', description: 'A presenter shows a plaid shoulder bag beside a swimming pool.' },
  { id: 'headphone-detail', title: 'Let the details do the talking.', label: 'Product close-up', description: 'Close-up views of silver headphones, their headband and ear cups.' },
  { id: 'web-sneakers', title: 'Give the familiar a twist.', label: 'Playful effects', description: 'A person rests their sneaker-clad feet on a couch as a web pulls at the shoes.' },
  { id: 'checkered-mug', title: 'Turn a small object into a moment.', label: 'Everyday ritual', description: 'A black and white checkered mug with a pink interior, shown in a home setting.' },
  { id: 'bathroom-remake', title: 'A scene with a punchline.', label: 'Lifestyle remake', description: 'A bathroom wall sign becomes the focus of a short domestic comedy scene.' },
  { id: 'cleaner-demo', title: 'Show the problem up close.', label: 'Product demonstration', description: 'A presenter points out a spill on a kitchen counter during a cleaning demonstration.' },
  { id: 'bathroom-original', title: 'Start with a reference.', label: 'Original reference', description: 'The original bathroom wall-sign scene supplied alongside the remake.' },
];
type Clip = typeof clips[number];

export function VideoShowcase() {
  const [start, setStart] = useState(0);
  const [selected, setSelected] = useState<Clip | null>(null);
  const visibleClips = Array.from({ length: 7 }, (_, index) => clips[(start + index) % clips.length]);

  return <section className="video-showcase" aria-label="Video inspiration gallery">
    <div className="video-showcase-fan">
      <ul className="video-showcase-track" aria-label="Supplied video references">
        {visibleClips.map((clip, index) => <li key={clip.id} style={{ '--fan-offset': index - 3, '--fan-drop': Math.pow(index - 3, 2) } as CSSProperties}>
          <button className="video-showcase-card" onClick={() => setSelected(clip)} aria-label={`Watch ${clip.label}`}>
            <SilentVideo id={clip.id} suspended={selected !== null} />
            <span className="video-showcase-shade" />
            <span className="video-showcase-expand"><Expand size={16} aria-hidden="true" /></span>
            <span className="video-showcase-label">{clip.label}</span>
          </button>
        </li>)}
      </ul>
    </div>
    <div className="video-showcase-footer">
      <div><p className="video-showcase-kicker">A little inspiration goes a long way.</p><p>Supplied reference clips · Silent previews · Not VIDZO-generated results</p></div>
      <div className="video-showcase-controls">
        <button onClick={() => setStart(current => (current + clips.length - 1) % clips.length)} aria-label="Previous references"><ArrowLeft size={18} /></button>
        <button onClick={() => setStart(current => (current + 1) % clips.length)} aria-label="Next references"><ArrowRight size={18} /></button>
      </div>
    </div>
    <p className="sr-only" aria-live="polite">Showing seven clips, starting with reference {start + 1} of {clips.length}.</p>
    <Modal open={selected !== null} close={() => setSelected(null)} title={selected?.title ?? 'Video reference'}>
      {selected && <div className="video-showcase-player"><SilentVideo key={selected.id} id={selected.id} label={selected.label} /><p>{selected.description}</p><small>Supplied reference · Silent preview · Not a VIDZO output</small></div>}
    </Modal>
  </section>;
}
