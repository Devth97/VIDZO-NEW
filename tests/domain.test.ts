import { describe, expect, it } from 'vitest';
import {
  newProject, updateScene, approveScene, createQuote, assertQuote, reserve, finalize, purchase, validateReference, roleCandidates,
  setRoles, selectCandidate, sceneState, currentFrame, currentClip, currentExport, exportDepHash, clipDepHash, sceneDepHash, stepBlocker,
  addScene, removeScene, toggleLock, updateAnalysisText, migrateV1Project,
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
const withFrames = (p: Project) => ({ ...p, assets: [...p.assets, ...p.scenes.map(s => asset('frame', { sceneId: s.id, depHash: sceneDepHash(p, s) }))] });
function approvedAll(p: Project) { for (const s of p.scenes) p = approveScene(p, s.id, currentFrame(p, s)!.id); return p; }
function withClips(p: Project) { return { ...p, assets: [...p.assets, ...p.scenes.map(s => asset('clip', { sceneId: s.id, depHash: clipDepHash(p, s)! }))] }; }
function ready() {
  let p = sampleProject();
  p = { ...p, scenes: p.scenes.map(s => ({ ...s, seconds: 4 })) };
  return approvedAll(withFrames(p));
}

describe('reference validation', () => {
  it('rejects unsupported types, oversize media, missing rights and invalid duration', () => {
    for (const override of [{ mime: 'text/html' }, { bytes: 100_000_001 }, { rights: false }, { seconds: 4 }, { seconds: 31 }, { seconds: NaN }]) {
      expect(() => validateReference({ mime: 'video/mp4', bytes: 1000, seconds: 10, rights: true, ...override })).toThrow();
    }
  });
  it('accepts the documented boundaries', () => {
    expect(() => validateReference({ mime: 'video/quicktime', bytes: 100_000_000, seconds: 30, rights: true })).not.toThrow();
    expect(() => validateReference({ mime: 'video/mp4', bytes: 1, seconds: 5, rights: true })).not.toThrow();
  });
});

describe('dependency invalidation', () => {
  it('changing one scene prompt invalidates only that frame, approval, clip and the export', () => {
    let p = withClips(ready());
    p = { ...p, assets: [...p.assets, asset('export', { depHash: exportDepHash(p)! })] };
    expect(currentExport(p)).toBeDefined();
    const next = updateScene(p, p.scenes[0].id, { prompt: 'A brand new opening composition.' });
    const [a, b, c] = next.scenes.map(s => sceneState(next, s));
    expect(a.approved).toBe(false); expect(a.approvalStale).toBe(true); expect(a.frame).toBeUndefined(); expect(a.clip).toBeUndefined();
    expect(b.approved && c.approved).toBe(true); expect(b.clip && c.clip).toBeTruthy();
    expect(currentExport(next)).toBeUndefined();
    expect(next.scenes[0].history.at(-1)?.prompt).toBe(p.scenes[0].prompt);
    expect(next.scenes[0].version).toBe(p.scenes[0].version + 1);
    expect(sceneState(p, p.scenes[0]).approved).toBe(true); // input not mutated
  });
  it('reverting a prompt restores the earlier frame without regenerating', () => {
    const p = ready(); const original = p.scenes[0].prompt;
    const back = updateScene(updateScene(p, p.scenes[0].id, { prompt: 'Changed' }), p.scenes[0].id, { prompt: original });
    expect(sceneState(back, back.scenes[0]).frame?.id).toBe(currentFrame(p, p.scenes[0])?.id);
  });
  it('visual brief changes invalidate frames, overlay-only changes invalidate only the export', () => {
    let p = withClips(ready());
    p = { ...p, assets: [...p.assets, asset('export', { depHash: exportDepHash(p)! })] };
    const cta = { ...p, brief: { ...p.brief, cta: 'Shop now' } };
    expect(cta.scenes.every(s => sceneState(cta, s).clip)).toBe(true);
    expect(currentExport(cta)).toBeUndefined();
    const tone = { ...p, brief: { ...p.brief, tone: 'Playful' } };
    expect(tone.scenes.some(s => sceneState(tone, s).approved)).toBe(false);
    const logo = { ...p, assets: [...p.assets, asset('logo')] };
    expect(logo.scenes.every(s => currentClip(logo, s))).toBe(true);
    expect(currentExport(logo)).toBeUndefined();
  });
  it('analysis text edits do not invalidate storyboard work', () => {
    const p = ready();
    const next = updateAnalysisText(p, { summary: 'Different summary', hook: 'Different hook', cta: 'Different' });
    expect(next.scenes.every(s => sceneState(next, s).approved)).toBe(true);
  });
  it('rejects analysis timestamps outside the reference duration', () => {
    const p = ready();
    expect(() => updateAnalysisText(p, { shots: [{ ...p.analysis!.shots[0], endMs: 12_001 }] })).toThrow(/within/);
  });
  it('changing an identity invalidates only scenes that feature that role', () => {
    let p = sampleProject();
    p = setRoles(p, [{ id: 'role-1', description: 'Adult presenter', confidence: 0.6 }]);
    const [c1, c2] = p.candidates;
    p = { ...p, assets: [...p.assets, asset('character', { candidateId: c1.id, version: 1 }), asset('character', { candidateId: c2.id, version: 1 })] };
    p = selectCandidate(p, 'role-1', c1.id, true);
    p = updateScene(p, p.scenes[0].id, { roleIds: ['role-1'] });
    p = approvedAll(withFrames(p));
    const switched = selectCandidate(p, 'role-1', c2.id, true);
    expect(sceneState(switched, switched.scenes[0]).approved).toBe(false);
    expect(sceneState(switched, switched.scenes[1]).approved).toBe(true);
    const redrawn = { ...p, assets: [...p.assets, asset('character', { candidateId: c1.id, version: 2 })] };
    expect(sceneState(redrawn, redrawn.scenes[0]).approved).toBe(false);
    expect(sceneState(redrawn, redrawn.scenes[2]).approved).toBe(true);
  });
  it('requires a real current frame for approval', () => {
    const p = newProject('Test');
    expect(() => approveScene(p, p.scenes[0].id, crypto.randomUUID())).toThrow(/frame/i);
    const framed = withFrames(p);
    expect(() => approveScene(framed, framed.scenes[0].id, crypto.randomUUID())).toThrow(/out of date/i);
  });
});

describe('roles and candidates', () => {
  it('uses 0, 3, or 2 choices per role with at most two roles', () => {
    expect(roleCandidates(0)).toBe(0); expect(roleCandidates(1)).toBe(3); expect(roleCandidates(2)).toBe(2);
    expect(() => roleCandidates(3)).toThrow();
  });
  it('preserves unchanged roles and their selection when another role is added', () => {
    let p = setRoles(sampleProject(), [{ id: 'role-1', description: 'Presenter', confidence: 0.5 }]);
    expect(p.candidates).toHaveLength(3);
    const keep = p.candidates[1];
    p = selectCandidate(p, 'role-1', keep.id, false);
    p = setRoles(p, [p.analysis!.roles[0], { id: 'role-2', description: 'Friend', confidence: 0.5 }]);
    expect(p.candidates.filter(c => c.roleId === 'role-1')).toHaveLength(2);
    expect(p.candidates.filter(c => c.roleId === 'role-2')).toHaveLength(2);
    expect(p.selections['role-1']).toBe(keep.id);
    const changed = setRoles(p, [{ ...p.analysis!.roles[0], description: 'Chef' }, p.analysis!.roles[1]]);
    expect(changed.selections['role-1']).toBeUndefined();
  });
  it('requires a sheet before selection when asked', () => {
    const p = setRoles(sampleProject(), [{ id: 'role-1', description: 'Presenter', confidence: 0.5 }]);
    expect(() => selectCandidate(p, 'role-1', p.candidates[0].id, true)).toThrow(/sheet/);
  });
});

describe('scenes', () => {
  it('limits scene count, lock and duration', () => {
    let p = addScene(newProject('Test'));
    expect(() => addScene(p)).toThrow(/four/);
    p = toggleLock(p, p.scenes[0].id);
    expect(() => updateScene(p, p.scenes[0].id, { prompt: 'Changed' })).toThrow(/unlock/i);
    expect(() => removeScene(p, p.scenes[0].id)).toThrow(/unlock/i);
    expect(() => updateScene(p, p.scenes[1].id, { seconds: 9 })).toThrow(/2–8/);
    expect(removeScene(p, p.scenes[3].id).scenes).toHaveLength(3);
  });
  it('blocks generation when total is outside 10–15 seconds', () => {
    const p = ready();
    const long = approvedAll(withFrames(updateScene(p, p.scenes[0].id, { seconds: 8 })));
    expect(stepBlocker(long, 5)).toMatch(/10–15/);
  });
});

describe('quotes', () => {
  it('requires every frame approved', () => expect(() => createQuote(sampleProject(), 'professional', 'video', undefined, pricing, 1000)).toThrow());
  it('quotes only scenes missing a current clip and binds to dependencies', () => {
    const p = ready();
    const q = createQuote(p, 'professional', 'video', undefined, pricing, 1000);
    expect(q.credits).toBe(12 * pricing.perSecond.professional);
    expect(q.tasks).toHaveLength(3);
    expect(() => assertQuote(p, q, pricing, 1001)).not.toThrow();
    expect(() => assertQuote(p, q, pricing, q.expiresAt)).toThrow(/expired/i);
    expect(() => assertQuote(updateScene(p, p.scenes[0].id, { prompt: 'Changed' }), q, pricing, 1001)).toThrow(/changed/);
    expect(() => assertQuote({ ...p, brief: { ...p.brief, color: '#000000' } }, q, pricing, 1001)).toThrow(/changed/);
    expect(() => assertQuote(p, { ...q, tier: 'premium' }, pricing, 1001)).toThrow(/changed/);
    expect(() => assertQuote(p, q, { ...pricing, version: 'other' }, 1001)).toThrow(/changed/);
    // after one clip exists, a video quote covers the remaining scenes only
    const partial = { ...p, assets: [...p.assets, asset('clip', { sceneId: p.scenes[0].id, depHash: clipDepHash(p, p.scenes[0])! })] };
    expect(createQuote(partial, 'premium', 'video', undefined, pricing).tasks.map(t => t.sceneId)).toEqual([p.scenes[1].id, p.scenes[2].id]);
  });
  it('quotes export only when all clips are current', () => {
    const p = ready();
    expect(() => createQuote(p, 'professional', 'export', undefined, pricing)).toThrow(/clip/);
    expect(createQuote(withClips(p), 'professional', 'export', undefined, pricing).tasks).toHaveLength(1);
  });
});

describe('wallet model', () => {
  const base = { available: 200, held: 0, spent: 0, operations: [] };
  it('rejects noninteger credits and reservations that exceed balance', () => {
    expect(() => reserve({ ...base, available: 100 }, 101, 'a')).toThrow();
    expect(() => reserve(base, 1.5, 'a')).toThrow();
    expect(() => reserve(base, -1, 'a')).toThrow();
  });
  it('is idempotent for duplicate reserve and finalization; partial settlement releases the rest', () => {
    const held = reserve(base, 100, 'job');
    expect(reserve(held, 100, 'job')).toEqual(held);
    expect(() => reserve(held, 50, 'job')).toThrow();
    const done = finalize(held, 'job', 60);
    expect(done).toMatchObject({ available: 140, held: 0, spent: 60 });
    expect(finalize(done, 'job', 60)).toEqual(done);
    expect(() => finalize(done, 'job', 100)).toThrow();
    expect(() => finalize(held, 'job', 101)).toThrow();
    expect(finalize(held, 'job', 0)).toMatchObject({ available: 200, held: 0, spent: 0 });
  });
  it('does not allow settlement without matching reservation', () => {
    expect(() => finalize({ available: 100, held: 100, spent: 0, operations: [] }, 'other', 100)).toThrow();
  });
  it('purchases are idempotent per payment', () => {
    const w = purchase(base, 'pay_1', 100);
    expect(purchase(w, 'pay_1', 100)).toEqual(w);
    expect(w.available).toBe(300);
  });
});

describe('client edit merge (server trust boundary)', () => {
  it('ignores client-supplied server facts', () => {
    const stored = ready();
    const forged = {
      ...stored, sample: false, status: 'ready', qa: { exportAssetId: crypto.randomUUID(), decision: 'approved', at: 'x' },
      assets: [...stored.assets, asset('export')], scenes: stored.scenes.map(s => ({ ...s, version: 99, history: [], approval: { frameAssetId: crypto.randomUUID(), depHash: 'x', at: 'x' } })),
      name: 'Renamed',
    };
    const merged = mergeClientEdits(stored, forged, { requireSheets: true });
    expect(merged.name).toBe('Renamed');
    expect(merged.assets).toEqual(stored.assets);
    expect(merged.status).toBe(stored.status); expect(merged.qa).toBeNull(); expect(merged.sample).toBe(true);
    expect(merged.scenes.map(s => s.approval)).toEqual(stored.scenes.map(s => s.approval));
    expect(merged.scenes.map(s => s.version)).toEqual(stored.scenes.map(s => s.version));
  });
  it('versions substantive scene edits server-side and refuses edits to locked scenes', () => {
    const r = ready(); const stored = toggleLock(r, r.scenes[0].id);
    const edit = { ...stored, scenes: stored.scenes.map((s, i) => (i === 1 ? { ...s, prompt: 'New idea' } : s)) };
    const merged = mergeClientEdits(stored, edit, { requireSheets: true });
    expect(merged.scenes[1].version).toBe(stored.scenes[1].version + 1);
    expect(merged.scenes[1].history.at(-1)?.prompt).toBe(stored.scenes[1].prompt);
    const locked = { ...stored, scenes: stored.scenes.map((s, i) => (i === 0 ? { ...s, prompt: 'Sneaky' } : s)) };
    expect(() => mergeClientEdits(stored, locked, { requireSheets: true })).toThrow(/unlock/i);
  });
  it('clamps the step to the furthest step whose prerequisites hold', () => {
    const stored = newProject('Test');
    expect(mergeClientEdits(stored, { ...stored, step: 6 }, { requireSheets: true }).step).toBe(0);
  });
  it('does not let a client create an analysis or select an identity without a sheet', () => {
    const stored = newProject('Test');
    const withAnalysis = { ...stored, analysis: sampleProject().analysis };
    expect(mergeClientEdits(stored, withAnalysis, { requireSheets: true }).analysis).toBeNull();
    const roles = setRoles(sampleProject(), [{ id: 'role-1', description: 'Presenter', confidence: 0.5 }]);
    expect(() => mergeClientEdits(roles, { ...roles, selections: { 'role-1': roles.candidates[0].id } }, { requireSheets: true })).toThrow(/sheet/);
  });
});

describe('v1 demo draft migration', () => {
  it('converts the old shape without trusting old approvals', () => {
    const old = { id: crypto.randomUUID(), name: 'Old', updatedAt: new Date().toISOString(), step: 6, revision: 3, rights: true, sample: true, assets: [], analysis: null, characters: [], brief: newProject('x').brief, status: 'ready', scenes: [{ id: crypto.randomUUID(), title: 'A', seconds: 4, prompt: 'p', version: 2, approved: true, locked: false, frameApproved: true, history: [{ version: 1, prompt: 'o' }] }] };
    const p = migrateV1Project(old);
    expect(p.scenes[0].approval).toBeNull();
    expect(p.step).toBe(4);
    expect(p.status).toBe('draft');
  });
});
