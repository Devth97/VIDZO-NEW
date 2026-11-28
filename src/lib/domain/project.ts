import { stableHash, canonical } from './hash';
import { type Pricing, retryPolicy } from './pricing';
import type { Analysis, Asset, Brief, Candidate, Project, Quote, QuoteScope, QuoteTask, Role, Scene, Tier, Wallet } from './schema';

// ---------------------------------------------------------------------------------------------
// Project creation and reference rules
// ---------------------------------------------------------------------------------------------

const defaultScenes = [
  { title: 'The hook', seconds: 4, prompt: 'Open with a distinctive close-up of the original product. Soft directional light, deliberate camera push-in. No text or third-party marks.' },
  { title: 'The product moment', seconds: 4, prompt: 'Show the actual product in context, preserving its shape, material and packaging. A slow orbit reveals the key details.' },
  { title: 'The invitation', seconds: 4, prompt: 'A clean hero composition with the original product centered. Leave clear space for the exact brand logo and call to action overlay.' },
];

export function newScene(title: string, seconds: number, prompt: string): Scene {
  return { id: crypto.randomUUID(), title, seconds, prompt, roleIds: [], locked: false, version: 1, history: [], approval: null };
}

export function newProject(name: string, now = new Date()): Project {
  return {
    id: crypto.randomUUID(), name: name.trim().slice(0, 100) || 'Untitled project', updatedAt: now.toISOString(), step: 0, revision: 0,
    rights: false, sample: false, assets: [], analysis: null, candidates: [], selections: {}, status: 'draft', qa: null,
    brief: { brand: '', product: '', color: '#445A39', font: '', objective: 'Product launch', audience: '', language: 'English', tone: 'Premium and confident', cta: 'Discover the collection', offer: '', claims: '', differences: '' },
    scenes: defaultScenes.map(s => newScene(s.title, s.seconds, s.prompt)),
  };
}

export const referenceLimits = { maxBytes: 100_000_000, minSeconds: 5, maxSeconds: 30, imageMaxBytes: 10_000_000 } as const;

export function validateReference(file: { mime: string; bytes: number; seconds: number; rights: boolean }) {
  if (!file.rights) throw new Error('Confirm your rights to use this reference.');
  if (!['video/mp4', 'video/quicktime'].includes(file.mime)) throw new Error('Use an MP4 or MOV video.');
  if (!Number.isFinite(file.bytes) || file.bytes <= 0 || file.bytes > referenceLimits.maxBytes) throw new Error('The reference must be 100 MB or smaller.');
  if (!Number.isFinite(file.seconds) || file.seconds < referenceLimits.minSeconds || file.seconds > referenceLimits.maxSeconds) throw new Error('The reference must be 5–30 seconds.');
}

// ---------------------------------------------------------------------------------------------
// Analysis, roles and candidates
// ---------------------------------------------------------------------------------------------

export function roleCandidates(count: number) {
  if (![0, 1, 2].includes(count)) throw new Error('Launch supports at most two character roles.');
  return count === 0 ? 0 : count === 1 ? 3 : 2;
}

const candidateNames = [['Alex', 'Robin', 'Jamie'], ['Sam', 'Noor', 'Kiran']];

/** Keeps candidates (and therefore their identity sheets) for roles whose description did not change. */
export function candidatesForRoles(roles: Role[], existing: Candidate[]): Candidate[] {
  const count = roleCandidates(roles.length);
  return roles.flatMap((role, r) => {
    const kept = existing.filter(c => c.roleId === role.id && c.roleDescription === role.description).slice(0, count);
    const fresh = Array.from({ length: count - kept.length }, (_, i) => {
      const n = kept.length + i;
      return { id: crypto.randomUUID(), roleId: role.id, roleDescription: role.description, name: candidateNames[r]?.[n] ?? `Option ${n + 1}`, description: `Original ${role.description.toLowerCase() || 'character'}. Option ${n + 1}; no likeness derived from the reference.` };
    });
    return [...kept, ...fresh];
  });
}

export function validateAnalysis(a: Analysis) {
  if (a.roles.length > 2) throw new Error('Launch supports at most two character roles.');
  const ids = new Set(a.roles.map(r => r.id));
  if (ids.size !== a.roles.length) throw new Error('Role identifiers must be unique.');
  for (const s of a.shots) {
    if (s.endMs <= s.startMs) throw new Error('Each shot must end after it starts.');
    if (a.durationMs !== undefined && s.endMs > a.durationMs) throw new Error('Shot timestamps must stay within the reference duration.');
    if (s.roleIds.some(id => !ids.has(id))) throw new Error('A shot refers to a role that does not exist.');
  }
}

/** Text edits to the reference read. They describe the source concept only, so they do not invalidate storyboard work. */
export function updateAnalysisText(p: Project, patch: Partial<Pick<Analysis, 'summary' | 'hook' | 'cta' | 'shots'>>): Project {
  if (!p.analysis) throw new Error('Analysis is not available yet.');
  const analysis = { ...p.analysis, ...patch };
  validateAnalysis(analysis);
  return { ...p, analysis };
}

/** Changing roles invalidates only scenes and identities that depend on changed roles (via dependency hashes). */
export function setRoles(p: Project, roles: Role[]): Project {
  if (!p.analysis) throw new Error('Analysis is not available yet.');
  roleCandidates(roles.length);
  const analysis = { ...p.analysis, roles, shots: p.analysis.shots.map(s => ({ ...s, roleIds: s.roleIds.filter(id => roles.some(r => r.id === id)) })) };
  validateAnalysis(analysis);
  const candidates = candidatesForRoles(roles, p.candidates);
  const selections = Object.fromEntries(Object.entries(p.selections).filter(([roleId, cid]) => roles.some(r => r.id === roleId) && candidates.some(c => c.id === cid && c.roleId === roleId)));
  const now = new Date().toISOString();
  const scenes = p.scenes.map(s => {
    const roleIds = s.roleIds.filter(id => roles.some(r => r.id === id));
    return roleIds.length === s.roleIds.length ? s : { ...s, roleIds, version: s.version + 1, history: [...s.history, { version: s.version, prompt: s.prompt, seconds: s.seconds, at: now }].slice(-200) };
  });
  return { ...p, analysis, candidates, selections, scenes };
}

export function selectCandidate(p: Project, roleId: string, candidateId: string, requireSheet: boolean): Project {
  const c = p.candidates.find(x => x.id === candidateId && x.roleId === roleId);
  if (!c) throw new Error('That identity is no longer available.');
  if (requireSheet && !currentSheet(p, candidateId)) throw new Error('Create the identity sheet before selecting this identity.');
  return { ...p, selections: { ...p.selections, [roleId]: candidateId } };
}

// ---------------------------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------------------------

export const sceneLimits = { max: 4, minTotal: 10, maxTotal: 15, minSeconds: 2, maxSeconds: 8 } as const;
export const totalSeconds = (p: Pick<Project, 'scenes'>) => p.scenes.reduce((n, s) => n + s.seconds, 0);

export function updateScene(p: Project, id: string, patch: Partial<Pick<Scene, 'title' | 'prompt' | 'seconds' | 'roleIds' | 'purpose' | 'productAction'>>): Project {
  const found = p.scenes.find(s => s.id === id);
  if (!found) throw new Error('Scene not found.');
  if (found.locked) throw new Error('Unlock this scene before editing.');
  const next = { ...found, ...patch };
  if (patch.prompt !== undefined && !patch.prompt.trim()) throw new Error('Describe your scene before saving.');
  if (!Number.isInteger(next.seconds) || next.seconds < sceneLimits.minSeconds || next.seconds > sceneLimits.maxSeconds) throw new Error('Each scene must be 2–8 seconds.');
  const roles = p.analysis?.roles ?? [];
  if (next.roleIds.length > 2 || next.roleIds.some(r => !roles.some(x => x.id === r))) throw new Error('Choose roles from your analysis.');
  const substantive = sceneChanged(found, next);
  if (!substantive && next.title === found.title && next.purpose === found.purpose) return p;
  const scene: Scene = substantive
    ? { ...next, version: found.version + 1, history: [...found.history, historyEntry(found, new Date().toISOString())].slice(-200) }
    : next;
  return { ...p, scenes: p.scenes.map(s => (s.id === id ? scene : s)) };
}

/** Generation inputs of a scene. Title and purpose are labels; changing them keeps frames and approvals. */
export const sceneChanged = (a: Scene, b: Scene) => a.prompt !== b.prompt || a.seconds !== b.seconds || canonical(a.roleIds) !== canonical(b.roleIds) || (a.productAction?.trim() || '') !== (b.productAction?.trim() || '');
export const historyEntry = (s: Scene, at: string): Scene['history'][number] => ({ version: s.version, prompt: s.prompt, seconds: s.seconds, productAction: s.productAction?.trim() || undefined, at });

export function addScene(p: Project): Project {
  if (p.scenes.length >= sceneLimits.max) throw new Error('A storyboard can have up to four scenes.');
  return { ...p, scenes: [...p.scenes, newScene(`Scene ${p.scenes.length + 1}`, 3, 'Describe a new original composition for your product.')] };
}

export function removeScene(p: Project, id: string): Project {
  const s = p.scenes.find(x => x.id === id);
  if (!s) throw new Error('Scene not found.');
  if (s.locked) throw new Error('Unlock this scene before removing it.');
  if (p.scenes.length <= 1) throw new Error('Keep at least one scene.');
  return { ...p, scenes: p.scenes.filter(x => x.id !== id) };
}

export function toggleLock(p: Project, id: string): Project {
  return { ...p, scenes: p.scenes.map(s => (s.id === id ? { ...s, locked: !s.locked } : s)) };
}

// ---------------------------------------------------------------------------------------------
// Dependency map. Outputs are never mutated; they become stale when the hash they were made from
// no longer equals the current hash. This preserves unrelated scene work automatically.
//
//   frame(scene)   ← scene prompt/seconds/roles, VISUAL brief fields, verified product photos,
//                    selected identity sheet for each role in the scene
//   clip(scene)    ← frame dependency + the approved frame asset
//   export         ← every current clip, OVERLAY brief fields, latest verified logo
//   analysis text  → nothing downstream (it describes the reference, not the new ad)
// ---------------------------------------------------------------------------------------------

export const visualBriefKeys = ['brand', 'product', 'color', 'tone', 'differences'] as const satisfies readonly (keyof Brief)[];
export const overlayBriefKeys = ['brand', 'cta', 'font', 'offer', 'claims', 'language'] as const satisfies readonly (keyof Brief)[];

const pick = <K extends keyof Brief>(b: Brief, keys: readonly K[]) => Object.fromEntries(keys.map(k => [k, b[k]]));

export const fidelityLabels = { shape: 'Shape and proportions', colour: 'Colours and finish', packaging: 'Packaging and label text', prohibited: 'Must never change' } as const;
/** Non-empty product fidelity notes, in display order. Empty notes are omitted so older projects keep their hashes. */
export function fidelityNotes(b: Brief): [keyof typeof fidelityLabels, string][] {
  return (Object.keys(fidelityLabels) as (keyof typeof fidelityLabels)[]).map(k => [k, b.fidelity?.[k]?.trim() ?? ''] as [keyof typeof fidelityLabels, string]).filter(([, v]) => v);
}
const fidelityKey = (b: Brief) => { const n = fidelityNotes(b); return n.length ? Object.fromEntries(n) : undefined; };
const usable = (a: Asset) => a.status === 'verified';
function latest(assets: Asset[]): Asset | undefined {
  return [...assets].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : (a.version ?? 0) - (b.version ?? 0))).at(-1);
}

export const productAssets = (p: Project) => p.assets.filter(a => a.kind === 'product' && usable(a));
export const logoAsset = (p: Project) => latest(p.assets.filter(a => a.kind === 'logo' && usable(a)));
export const referenceAsset = (p: Project) => latest(p.assets.filter(a => a.kind === 'reference' && a.status !== 'rejected'));
export const currentSheet = (p: Project, candidateId: string) => latest(p.assets.filter(a => a.kind === 'character' && a.candidateId === candidateId && usable(a)));
export const sheetHistory = (p: Project, candidateId: string) => p.assets.filter(a => a.kind === 'character' && a.candidateId === candidateId && usable(a)).sort((a, b) => (a.version ?? 0) - (b.version ?? 0));

function identityKey(p: Project, roleId: string) {
  const cid = p.selections[roleId];
  return cid ? [cid, currentSheet(p, cid)?.id ?? null] : null;
}

export function sceneDepHash(p: Project, s: Scene): string {
  // Optional inputs are left undefined when empty: canonical() drops them, so projects without them keep their hashes.
  return stableHash({ v: 1, scene: { id: s.id, prompt: s.prompt, seconds: s.seconds, roleIds: s.roleIds, productAction: s.productAction?.trim() || undefined }, brief: pick(p.brief, visualBriefKeys), fidelity: fidelityKey(p.brief), products: productAssets(p).map(a => a.id).sort(), identities: s.roleIds.map(r => identityKey(p, r)) });
}

export const currentFrame = (p: Project, s: Scene) => { const h = sceneDepHash(p, s); return latest(p.assets.filter(a => a.kind === 'frame' && a.sceneId === s.id && a.depHash === h && usable(a))); };
export const frameHistory = (p: Project, s: Scene) => p.assets.filter(a => a.kind === 'frame' && a.sceneId === s.id && usable(a));

export function isApproved(p: Project, s: Scene): boolean {
  if (!s.approval) return false;
  const frame = currentFrame(p, s);
  return Boolean(frame && frame.id === s.approval.frameAssetId && s.approval.depHash === sceneDepHash(p, s));
}

export function clipDepHash(p: Project, s: Scene): string | null {
  if (!isApproved(p, s)) return null;
  return stableHash({ v: 1, scene: sceneDepHash(p, s), frame: s.approval!.frameAssetId });
}

export function currentClip(p: Project, s: Scene) {
  const h = clipDepHash(p, s);
  return h ? latest(p.assets.filter(a => a.kind === 'clip' && a.sceneId === s.id && a.depHash === h && usable(a))) : undefined;
}

export function exportDepHash(p: Project): string | null {
  const clips = p.scenes.map(s => currentClip(p, s)?.id ?? null);
  if (clips.some(c => !c)) return null;
  return stableHash({ v: 1, clips, overlay: pick(p.brief, overlayBriefKeys), logo: logoAsset(p)?.id ?? null });
}

export function currentExport(p: Project) {
  const h = exportDepHash(p);
  return h ? latest(p.assets.filter(a => a.kind === 'export' && a.depHash === h && usable(a))) : undefined;
}

export type SceneState = { depHash: string; frame?: Asset; approved: boolean; approvalStale: boolean; clip?: Asset; clipStale: boolean; frames: number };
export function sceneState(p: Project, s: Scene): SceneState {
  const frame = currentFrame(p, s), approved = isApproved(p, s), clip = currentClip(p, s);
  return { depHash: sceneDepHash(p, s), frame, approved, approvalStale: Boolean(s.approval) && !approved, clip, clipStale: !clip && p.assets.some(a => a.kind === 'clip' && a.sceneId === s.id), frames: frameHistory(p, s).length };
}

export function approveScene(p: Project, sceneId: string, frameAssetId: string, now = new Date()): Project {
  const s = p.scenes.find(x => x.id === sceneId);
  if (!s) throw new Error('Scene not found.');
  const frame = currentFrame(p, s);
  if (!frame) throw new Error('Create a storyboard frame for this scene before approving it.');
  if (frame.id !== frameAssetId) throw new Error('This frame is out of date. Review the latest frame.');
  return { ...p, scenes: p.scenes.map(x => (x.id === sceneId ? { ...x, approval: { frameAssetId, depHash: sceneDepHash(p, s), at: now.toISOString() } } : x)) };
}

export function unapproveScene(p: Project, sceneId: string): Project {
  return { ...p, scenes: p.scenes.map(x => (x.id === sceneId ? { ...x, approval: null } : x)) };
}

/** True when the user has a complete set of current clips but no current export yet. */
export const allClipsCurrent = (p: Project) => p.scenes.every(s => currentClip(p, s));

// ---------------------------------------------------------------------------------------------
// Step prerequisites (enforced in the UI and again on the server for spend endpoints)
// ---------------------------------------------------------------------------------------------

export function stepBlocker(p: Project, step: number): string | null {
  if (step >= 1 && (!p.rights || (!p.sample && referenceAsset(p)?.status !== 'verified'))) return 'Add a verified reference and confirm your rights first.';
  if (step >= 2 && !p.analysis) return 'Review your reference analysis first.';
  if (step >= 3) for (const r of p.analysis?.roles ?? []) {
    const cid = p.selections[r.id];
    if (!cid || !currentSheet(p, cid)) return 'Select an original identity with a sheet for each role.';
  }
  if (step >= 4) {
    if (!p.brief.brand.trim() || !p.brief.product.trim() || !p.brief.cta.trim() || !p.brief.differences.trim()) return 'Add your brand, product, call to action and original creative differences.';
    if (!p.sample && (!productAssets(p).length || !logoAsset(p))) return 'Add at least one verified product photo and your exact logo.';
  }
  if (step >= 5) {
    const t = totalSeconds(p);
    if (t < sceneLimits.minTotal || t > sceneLimits.maxTotal) return 'Your storyboard must total 10–15 seconds.';
    if (!p.scenes.every(s => isApproved(p, s))) return 'Approve a current frame for every scene first.';
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Quotes. Tasks carry the dependency hash they will be produced from, and the fingerprint binds the
// quote to tier, scope, pricing version and every task. The server recomputes it before spending.
// ---------------------------------------------------------------------------------------------

export function quoteTasks(p: Project, tier: Tier, scope: QuoteScope, targetId: string | undefined, pricing: Pricing): QuoteTask[] {
  const id = () => crypto.randomUUID();
  const scene = (sid?: string) => { const s = p.scenes.find(x => x.id === sid); if (!s) throw new Error('Scene not found.'); return s; };
  switch (scope) {
    case 'frame': {
      if (stepBlocker(p, 4)) throw new Error(stepBlocker(p, 4)!);
      const scenes = targetId ? [scene(targetId)] : p.scenes.filter(s => !currentFrame(p, s));
      if (scenes.some(s => s.locked)) throw new Error('Unlock this scene to create a new frame.');
      if (!scenes.length) throw new Error('Every scene already has a current frame.');
      return scenes.map(s => ({ taskId: id(), kind: 'frame', sceneId: s.id, depHash: sceneDepHash(p, s), credits: pricing.frame }));
    }
    case 'characters': {
      const role = p.analysis?.roles.find(r => r.id === targetId);
      if (!role) throw new Error('Role not found.');
      const missing = p.candidates.filter(c => c.roleId === role.id && !currentSheet(p, c.id));
      if (!missing.length) throw new Error('Every identity for this role already has a sheet. Quote a single redraw instead.');
      return missing.map(c => ({ taskId: id(), kind: 'character', candidateId: c.id, depHash: stableHash(c), credits: pricing.characterSheet }));
    }
    case 'character': {
      const c = p.candidates.find(x => x.id === targetId);
      if (!c) throw new Error('Identity not found.');
      return [{ taskId: id(), kind: 'character', candidateId: c.id, depHash: stableHash(c), credits: pricing.characterSheet }];
    }
    case 'video':
    case 'scene': {
      const blocker = stepBlocker(p, 5);
      if (blocker) throw new Error(blocker);
      const scenes = scope === 'scene' ? [scene(targetId)] : p.scenes.filter(s => !currentClip(p, s));
      if (!scenes.length) throw new Error('Every scene already has a current clip.');
      return scenes.map(s => ({ taskId: id(), kind: 'clip', sceneId: s.id, depHash: clipDepHash(p, s)!, seconds: s.seconds, credits: s.seconds * pricing.perSecond[tier] }));
    }
    case 'export': {
      const h = exportDepHash(p);
      if (!h) throw new Error('Every scene needs a current, reviewed clip before final assembly.');
      return [{ taskId: id(), kind: 'export', depHash: h, credits: pricing.export }];
    }
  }
}

export function quoteFingerprint(p: Project, tier: Tier, scope: QuoteScope, targetId: string | undefined, pricing: Pricing, tasks: QuoteTask[]) {
  return canonical({ projectId: p.id, tier, scope, targetId: targetId ?? null, pricing: pricing.version, tasks: tasks.map(t => [t.kind, t.sceneId ?? null, t.candidateId ?? null, t.depHash, t.credits]) });
}

export function createQuote(p: Project, tier: Tier, scope: QuoteScope, targetId: string | undefined, pricing: Pricing, now = Date.now()): Quote {
  const tasks = quoteTasks(p, tier, scope, targetId, pricing);
  const credits = tasks.reduce((n, t) => n + t.credits, 0);
  const clip = scope === 'video' || scope === 'scene';
  return {
    id: crypto.randomUUID(), projectId: p.id, tier, scope, targetId, tasks, credits,
    seconds: tasks.reduce((n, t) => n + (t.seconds ?? 0), 0), expiresAt: now + pricing.quoteTtlMinutes * 60_000,
    nativeResolution: clip ? pricing.nativeResolution[tier] : scope === 'export' ? '1080 × 1920 delivery' : 'Image endpoint dependent',
    model: clip ? pricing.models[tier] : scope === 'export' ? 'Deterministic assembly' : pricing.models.image,
    pricingVersion: pricing.version, retryPolicy, illustrative: pricing.illustrative,
    fingerprint: quoteFingerprint(p, tier, scope, targetId, pricing, tasks),
  };
}

export const deliveryTarget = { width: 1080, height: 1920, fps: 30, label: '1080 × 1920 MP4 · 30 fps · H.264/AAC' } as const;

/** Plain-language upscale disclosure for a configured native resolution such as "720 × 1280" or "1080x1920". */
export function upscaleDisclosure(native: string): string {
  const m = native.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  if (!m) return 'Native resolution is disclosed once the production endpoint is benchmarked. Any upscale to 1080 × 1920 will be stated.';
  const [w, h] = [Number(m[1]), Number(m[2])].sort((a, b) => a - b);
  return w >= deliveryTarget.width && h >= deliveryTarget.height ? 'Generated at or above 1080 × 1920. No upscaling.' : `Generated at ${w} × ${h}, then upscaled to 1080 × 1920 for delivery.`;
}

/** Why a quote can no longer be confirmed, or null while it is valid against the current project. */
export function quoteProblem(p: Project, quote: Quote, pricing: Pricing, now = Date.now()): string | null {
  try { assertQuote(p, quote, pricing, now); return null; } catch (e) { return (e as Error).message; }
}

export function assertQuote(p: Project, quote: Quote, pricing: Pricing, now = Date.now()) {
  if (now >= quote.expiresAt) throw new Error('This quote expired. Request a fresh quote.');
  if (quote.projectId !== p.id || quote.pricingVersion !== pricing.version) throw new Error('The project changed. Review it and request a new quote.');
  let tasks: QuoteTask[];
  try { tasks = quoteTasks(p, quote.tier, quote.scope, quote.targetId, pricing); } catch { throw new Error('The project changed. Review it and request a new quote.'); }
  if (quoteFingerprint(p, quote.tier, quote.scope, quote.targetId, pricing, tasks) !== quote.fingerprint) throw new Error('The project changed. Review it and request a new quote.');
}

// ---------------------------------------------------------------------------------------------
// Pure wallet model (mirrors the SQL functions; the database is the source of truth in live mode)
// ---------------------------------------------------------------------------------------------

function credits(n: number, allowZero = false) { if (!Number.isSafeInteger(n) || n < 0 || (!allowZero && n === 0)) throw new Error('Credits must be a positive integer.'); }

export function reserve(w: Wallet, amount: number, id: string): Wallet {
  credits(amount);
  const prior = w.operations.find(o => o.id === id && o.kind === 'reserve');
  if (prior) { if (prior.amount !== amount) throw new Error('Operation already exists with another amount.'); return w; }
  if (w.available < amount) throw new Error('Insufficient credits. Add credits to continue.');
  return { ...w, available: w.available - amount, held: w.held + amount, operations: [...w.operations, { id, amount, kind: 'reserve', at: new Date().toISOString() }] };
}

/** Settles `settleAmount` of a reservation and releases the remainder. Idempotent per operation id. */
export function finalize(w: Wallet, id: string, settleAmount: number): Wallet {
  credits(settleAmount, true);
  const reservation = w.operations.find(o => o.id === id && o.kind === 'reserve');
  if (!reservation) throw new Error('No matching credit reservation.');
  const done = w.operations.filter(o => o.id === id && (o.kind === 'settle' || o.kind === 'release'));
  if (done.length) {
    const settled = done.filter(o => o.kind === 'settle').reduce((n, o) => n + o.amount, 0);
    if (settled !== settleAmount) throw new Error('Operation already finalized.');
    return w;
  }
  if (settleAmount > reservation.amount || w.held < reservation.amount) throw new Error('Settlement exceeds the reservation.');
  const release = reservation.amount - settleAmount, at = new Date().toISOString();
  const ops = [...w.operations];
  if (settleAmount) ops.push({ id, amount: settleAmount, kind: 'settle', at });
  if (release) ops.push({ id, amount: release, kind: 'release', at });
  return { ...w, held: w.held - reservation.amount, spent: w.spent + settleAmount, available: w.available + release, operations: ops };
}

export function purchase(w: Wallet, id: string, amount: number): Wallet {
  credits(amount);
  if (w.operations.some(o => o.id === id && o.kind === 'purchase')) return w;
  return { ...w, available: w.available + amount, operations: [...w.operations, { id, amount, kind: 'purchase', at: new Date().toISOString() }] };
}

// ---------------------------------------------------------------------------------------------
// Prompt composition for providers. Only user-approved fields are used; reference analysis text is
// treated as untrusted data and never forwarded into generation prompts.
// ---------------------------------------------------------------------------------------------

export function buildScenePrompt(p: Project, s: Scene): string {
  const identities = s.roleIds.map(r => p.candidates.find(c => c.id === p.selections[r])?.description).filter(Boolean);
  return [
    s.prompt.trim(),
    ...(s.productAction?.trim() ? [`Product action: ${s.productAction.trim()}`] : []),
    `Product: ${p.brief.product} by ${p.brief.brand}. Preserve the exact product shape, material, colour and packaging from the supplied photos.`,
    ...fidelityNotes(p.brief).map(([k, v]) => `${fidelityLabels[k]}: ${v}`),
    `Mood: ${p.brief.tone}. Accent colour ${p.brief.color}.`,
    identities.length ? `Characters: ${identities.join(' | ')}. Original adults only; no resemblance to real people.` : 'No people.',
    'Vertical 9:16. No text, logos, watermarks or third-party marks; the exact logo and call to action are added later as overlays.',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Migration of v1 browser demo drafts (pre-dependency-hash schema)
// ---------------------------------------------------------------------------------------------

export function migrateV1Project(raw: Record<string, unknown>): Project {
  const r = raw as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const at = typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString();
  const characters: any[] = Array.isArray(r.characters) ? r.characters : []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const roles: Role[] = r.analysis?.roles ?? [];
  return {
    id: r.id, name: r.name || 'Untitled project', updatedAt: at, step: Math.min(Number(r.step) || 0, 4), revision: Number(r.revision) || 0,
    rights: Boolean(r.rights), sample: Boolean(r.sample), analysis: r.analysis ? { ...r.analysis, source: r.sample ? 'sample' : 'sample' } : null,
    candidates: characters.map(c => ({ id: String(c.id), roleId: String(c.roleId), name: String(c.name), description: String(c.description), roleDescription: roles.find(x => x.id === c.roleId)?.description ?? '' })),
    selections: Object.fromEntries(characters.filter(c => c.approved).map(c => [c.roleId, c.id])),
    brief: r.brief, status: 'draft', qa: null,
    assets: (Array.isArray(r.assets) ? r.assets : []).map((a: any) => ({ id: a.id, kind: a.kind, name: a.name, mime: a.mime, bytes: a.bytes, seconds: a.seconds, status: 'verified', placeholder: false, createdAt: at })), // eslint-disable-line @typescript-eslint/no-explicit-any
    scenes: (r.scenes as any[]).map(s => ({ id: s.id, title: s.title, seconds: s.seconds, prompt: s.prompt, roleIds: [], locked: Boolean(s.locked), version: s.version || 1, history: (s.history || []).map((h: any) => ({ version: h.version, prompt: h.prompt, seconds: s.seconds, at })), approval: null })), // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}
