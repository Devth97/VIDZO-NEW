import { describe, expect, it } from 'vitest';
import {
  approveScene, buildScenePrompt, clipDepHash, createQuote, currentFrame, fidelityNotes, quoteProblem, sceneDepHash, sceneState,
  updateScene, upscaleDisclosure,
} from '@/lib/domain/project';
import { mergeClientEdits } from '@/lib/domain/merge';
import { placeholderPricing as pricing } from '@/lib/domain/pricing';
import { sampleProject } from '@/lib/domain/sample';
import type { Asset, Project } from '@/lib/domain/schema';

let clock = 0;
function asset(kind: Asset['kind'], extra: Partial<Asset> = {}): Asset {
  clock++;
  return { id: crypto.randomUUID(), kind, name: kind, mime: 'image/png', bytes: 10, status: 'verified', placeholder: true, createdAt: new Date(1_700_000_000_000 + clock * 1000).toISOString(), ...extra };
}
function ready(): Project {
  let p = sampleProject();
  p = { ...p, scenes: p.scenes.map(s => ({ ...s, seconds: 4 })) };
  p = { ...p, assets: [...p.assets, ...p.scenes.map(s => asset('frame', { sceneId: s.id, depHash: sceneDepHash(p, s) }))] };
  for (const s of p.scenes) p = approveScene(p, s.id, currentFrame(p, s)!.id);
  return p;
}
const approved = (p: Project) => p.scenes.map(s => sceneState(p, s).approved);

describe('scene review fields', () => {
  it('leaves existing dependency hashes unchanged when the new optional fields are empty', () => {
    const p = ready();
    const blank: Project = { ...p, brief: { ...p.brief, fidelity: { shape: '', colour: ' ', packaging: '', prohibited: '' } }, scenes: p.scenes.map(s => ({ ...s, productAction: '  ' })) };
    expect(blank.scenes.map(s => sceneDepHash(blank, s))).toEqual(p.scenes.map(s => sceneDepHash(p, s)));
    expect(approved(blank)).toEqual([true, true, true]);
  });
  it('a product action is a generation input: it invalidates only its own scene and is versioned', () => {
    const p = ready();
    const next = updateScene(p, p.scenes[1].id, { productAction: 'Cap twists off' });
    expect(approved(next)).toEqual([true, false, true]);
    expect(next.scenes[1].version).toBe(p.scenes[1].version + 1);
    expect(next.scenes[1].history.at(-1)?.productAction).toBeUndefined();
    expect(buildScenePrompt(next, next.scenes[1])).toContain('Product action: Cap twists off');
    const back = updateScene(next, p.scenes[1].id, { productAction: '' });
    expect(approved(back)).toEqual([true, true, true]); // undoing restores the approved frame
  });
  it('title and purpose are labels: they keep frames, approvals and the version', () => {
    const p = ready();
    const next = updateScene(updateScene(p, p.scenes[0].id, { purpose: 'hook' }), p.scenes[0].id, { title: 'Opening' });
    expect(approved(next)).toEqual([true, true, true]);
    expect(next.scenes[0].version).toBe(p.scenes[0].version);
    expect(next.scenes[0].purpose).toBe('hook');
  });
  it('product fidelity notes reach every frame prompt and invalidate frames that were made without them', () => {
    const p = ready();
    const next: Project = { ...p, brief: { ...p.brief, fidelity: { packaging: 'Front label reads exactly', prohibited: 'No dropper' } } };
    expect(fidelityNotes(next.brief).map(([k]) => k)).toEqual(['packaging', 'prohibited']);
    expect(approved(next)).toEqual([false, false, false]);
    expect(buildScenePrompt(next, next.scenes[0])).toContain('Must never change: No dropper');
  });
  it('the server merge versions product-action edits and keeps purpose without a version bump', () => {
    const stored = ready();
    const edited = { ...stored, scenes: stored.scenes.map((s, i) => (i === 0 ? { ...s, productAction: 'Pump press' } : i === 1 ? { ...s, purpose: 'reveal' as const } : s)) };
    const merged = mergeClientEdits(stored, edited, { requireSheets: false });
    expect(merged.scenes[0].version).toBe(stored.scenes[0].version + 1);
    expect(merged.scenes[0].productAction).toBe('Pump press');
    expect(merged.scenes[1].version).toBe(stored.scenes[1].version);
    expect(merged.scenes[1].purpose).toBe('reveal');
  });
});

describe('quote clarity', () => {
  it('blocks final assembly while the on-screen call to action is too long', () => {
    let p = ready();
    p = { ...p, assets: [...p.assets, ...p.scenes.map(s => asset('clip', { sceneId: s.id, depHash: clipDepHash(p, s)! }))] };
    expect(createQuote(p, 'professional', 'export', undefined, pricing).tasks).toHaveLength(1);
    const long: Project = { ...p, brief: { ...p.brief, cta: 'x'.repeat(81) } };
    expect(() => createQuote(long, 'professional', 'export', undefined, pricing)).toThrow(/80 characters/);
  });
  it('discloses upscaling from the configured native resolution', () => {
    expect(upscaleDisclosure('720 × 1280')).toBe('Generated at 720 × 1280, then upscaled to 1080 × 1920 for delivery.');
    expect(upscaleDisclosure('1080x1920')).toBe('Generated at or above 1080 × 1920. No upscaling.');
    expect(upscaleDisclosure('Pending endpoint benchmark')).toMatch(/disclosed once/);
  });
  it('an expired or stale quote reports why it cannot be confirmed', () => {
    const p = ready();
    const withClips: Project = { ...p, assets: [...p.assets, asset('clip', { sceneId: p.scenes[0].id, depHash: clipDepHash(p, p.scenes[0])! })] };
    const q = createQuote(withClips, 'professional', 'video', undefined, pricing, 1000);
    expect(q.tasks).toHaveLength(2); // the scene with a current clip is not requoted
    expect(quoteProblem(withClips, q, pricing, 2000)).toBeNull();
    expect(quoteProblem(withClips, q, pricing, q.expiresAt)).toMatch(/expired/);
    const edited = updateScene(withClips, p.scenes[2].id, { prompt: 'A different closing composition.' });
    expect(quoteProblem(edited, q, pricing, 2000)).toMatch(/changed/);
  });
});
