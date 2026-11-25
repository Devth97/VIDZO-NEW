import { type Project, type Quote, type Tier, type Wallet, type Candidate } from './schema';

export function newProject(name: string): Project {
  return {
    id: crypto.randomUUID(), name: name.trim() || 'Untitled project', updatedAt: new Date().toISOString(), step: 0, revision: 0,
    rights: false, sample: false, assets: [], analysis: null, characters: [], status: 'draft',
    brief: { brand: '', product: '', color: '#A78BFA', font: '', objective: 'Product launch', audience: '', language: 'English', tone: 'Premium and confident', cta: 'Discover the collection', offer: '', claims: '', differences: '' },
    scenes: [
      { title: 'The hook', seconds: 4, prompt: 'Open with a distinctive close-up of the original product. Soft directional light, deliberate camera push-in. No text or third-party marks.' },
      { title: 'The product moment', seconds: 4, prompt: 'Show the actual product in context, preserving its shape, material and packaging. A slow orbit reveals the key details.' },
      { title: 'The invitation', seconds: 4, prompt: 'A clean hero composition with the original product centered. Leave clear space for the exact brand logo and call to action overlay.' },
    ].map(s => ({ ...s, id: crypto.randomUUID(), version: 1, approved: false, locked: false, frameApproved: false, history: [] })),
  };
}

export function validateReference(file: { mime: string; bytes: number; seconds: number; rights: boolean }) {
  if (!file.rights) throw new Error('Confirm your rights to use this reference.');
  if (!['video/mp4', 'video/quicktime'].includes(file.mime)) throw new Error('Use an MP4 or MOV video.');
  if (!Number.isFinite(file.bytes) || file.bytes <= 0 || file.bytes > 100_000_000) throw new Error('The reference must be 100 MB or smaller.');
  if (!Number.isFinite(file.seconds) || file.seconds < 5 || file.seconds > 30) throw new Error('The reference must be 5–30 seconds.');
}
export function roleCandidates(count: number) {
  if (![0, 1, 2].includes(count)) throw new Error('Launch supports at most two character roles.');
  return count === 0 ? 0 : count === 1 ? 3 : 2;
}
export function makeCandidates(roles: NonNullable<Project['analysis']>['roles']): Candidate[] {
  const count = roleCandidates(roles.length);
  const names = ['Alex', 'Robin', 'Jamie'];
  return roles.flatMap(role => Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), roleId: role.id, name: names[i], description: `Original ${role.description.toLowerCase()}. Option ${i + 1}; no likeness derived from the reference.`, version: 1, approved: false, history: [] })));
}
export function updateScene(project: Project, id: string, prompt: string): Project {
  const found = project.scenes.find(s => s.id === id);
  if (!found) throw new Error('Scene not found.');
  if (found.locked) throw new Error('Unlock this scene before editing.');
  if (!prompt.trim()) throw new Error('Describe your scene before saving.');
  if (found.prompt === prompt) return project;
  return { ...project, revision: project.revision + 1, exportUrl: undefined, status: 'draft', scenes: project.scenes.map(s => s.id === id ? {
    ...s, prompt, version: s.version + 1, approved: false, frameApproved: false, clipUrl: undefined, frameKey: undefined,
    history: [...s.history, { version: s.version, prompt: s.prompt, frameKey: s.frameKey, clipUrl: s.clipUrl }],
  } : s) };
}
export function approveScene(project: Project, id: string): Project {
  return { ...project, scenes: project.scenes.map(s => s.id === id ? { ...s, approved: true, frameApproved: project.sample || Boolean(s.frameKey) } : s) };
}
export function invalidateCreative(project: Project): Project {
  return { ...project, revision: project.revision + 1, status: 'draft', exportUrl: undefined, scenes: project.scenes.map(s => ({ ...s, version: s.version + 1, approved: false, frameApproved: false, frameKey: undefined, clipUrl: undefined, history: [...s.history, { version: s.version, prompt: s.prompt, frameKey: s.frameKey, clipUrl: s.clipUrl }] })) };
}
export function fingerprint(p: Project): string {
  return JSON.stringify({ id: p.id, brief: p.brief, rights: p.rights, assets: p.assets.map(a => a.id), characters: p.characters.filter(c => c.approved).map(c => [c.id, c.version]), scenes: p.scenes.map(s => [s.id, s.version, s.prompt, s.seconds, s.frameKey]) });
}
export function createQuote(p: Project, tier: Tier, now = Date.now()): Quote {
  if (!p.scenes.every(s => s.approved)) throw new Error('Approve every scene before requesting a quote.');
  const seconds = p.scenes.reduce((sum, s) => sum + s.seconds, 0);
  if (seconds < 10 || seconds > 15) throw new Error('Output must total 10–15 seconds.');
  return { id: crypto.randomUUID(), projectId: p.id, fingerprint: fingerprint(p), tier, credits: tier === 'professional' ? 150 : 225, seconds, expiresAt: now + 15 * 60_000, nativeResolution: 'Pending endpoint benchmark', model: tier === 'professional' ? 'Professional benchmark candidate' : 'Premium benchmark candidate', scope: 'video' };
}
export function assertQuote(p: Project, quote: Quote, now = Date.now()) {
  if (now >= quote.expiresAt) throw new Error('This quote expired. Request a fresh quote.');
  if (quote.projectId !== p.id || quote.fingerprint !== fingerprint(p) || !p.scenes.every(s => s.approved)) throw new Error('The project changed. Review scenes and request a new quote.');
}
function credits(n: number) { if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Credits must be a positive integer.'); }
export function reserve(w: Wallet, amount: number, id: string): Wallet {
  credits(amount);
  const prior = w.operations.find(o => o.id === id && o.kind === 'reserve');
  if (prior) { if (prior.amount !== amount) throw new Error('Operation already exists with another amount.'); return w; }
  if (w.available < amount) throw new Error('Insufficient credits. Add credits to continue.');
  return { ...w, available: w.available - amount, held: w.held + amount, operations: [...w.operations, { id, amount, kind: 'reserve', at: new Date().toISOString() }] };
}
export function finish(w: Wallet, amount: number, id: string, success: boolean): Wallet {
  credits(amount);
  const kind = success ? 'settle' : 'release';
  const prior = w.operations.find(o => o.id === id && ['settle', 'release'].includes(o.kind));
  if (prior) { if (prior.kind !== kind || prior.amount !== amount) throw new Error('Operation already finalized.'); return w; }
  if (!w.operations.some(o => o.id === id && o.kind === 'reserve' && o.amount === amount) || w.held < amount) throw new Error('No matching credit reservation.');
  return { ...w, held: w.held - amount, spent: w.spent + (success ? amount : 0), available: w.available + (success ? 0 : amount), operations: [...w.operations, { id, amount, kind, at: new Date().toISOString() }] };
}
