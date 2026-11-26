import type { Objective } from './draft-intent';

/** Ad formats are story structures, not results. Picking one fills a draft brief that stays editable. */
export type Format = { name: string; objective: Objective; job: string; beats: string[]; tone: string; shot: string; overlay?: 'split' | 'list' | 'box' | 'steps' | 'offer' };

export const adFormats: Format[] = [
  { name: 'Product reveal', objective: 'Product launch', job: 'Tease the details, then show the whole product.', beats: ['Close detail', 'Full reveal', 'Where to get it'], tone: 'peach', shot: 'close' },
  { name: 'Problem to solution', objective: 'Product education', job: 'Show an everyday problem, then the product solving it.', beats: ['The problem', 'The product', 'The result'], tone: 'sage', shot: 'shelf', overlay: 'split' },
  { name: 'Unboxing', objective: 'Product launch', job: 'Hands open the pack. First look, then the hero detail.', beats: ['The pack', 'First look', 'Hero detail'], tone: 'butter', shot: 'light', overlay: 'box' },
  { name: 'Three reasons', objective: 'Brand awareness', job: 'One reason per scene, numbered on screen.', beats: ['Reason one', 'Reason two', 'Reason three'], tone: 'lavender', shot: 'orbit', overlay: 'list' },
  { name: 'How it works', objective: 'Product education', job: 'Three quick steps of the product in use.', beats: ['Step one', 'Step two', 'The payoff'], tone: 'cream', shot: 'shelf', overlay: 'steps' },
  { name: 'Seasonal offer', objective: 'Offer promotion', job: 'The product, the offer and the dates it runs.', beats: ['The product', 'The offer', 'Valid dates'], tone: 'peach', shot: 'end', overlay: 'offer' },
];

export const formatDirection = (f: Format) => `${f.name}: ${f.job} Scenes: ${f.beats.join(' → ')}.`;
