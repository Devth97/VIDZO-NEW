import { describe, expect, it } from 'vitest';
import { newProject, updateScene, approveScene, createQuote, assertQuote, reserve, finish, validateReference, roleCandidates } from '@/lib/domain/project';

describe('reference validation', () => {
  it('rejects unsupported types, oversize media, missing rights and invalid duration', () => {
    for (const override of [{ mime: 'text/html' }, { bytes: 100_000_001 }, { rights: false }, { seconds: 4 }, { seconds: 31 }, { seconds: NaN }]) {
      expect(() => validateReference({ mime: 'video/mp4', bytes: 1000, seconds: 10, rights: true, ...override })).toThrow();
    }
  });
  it('accepts the documented boundaries', () => {
    expect(() => validateReference({ mime: 'video/quicktime', bytes: 100_000_000, seconds: 30, rights: true })).not.toThrow();
  });
});
describe('immutable scene dependencies', () => {
  it('invalidates only the edited clip and export, retaining other approvals and history', () => {
    let p = newProject('Test');
    p = { ...p, scenes: p.scenes.map(s => ({ ...s, approved: true, clipUrl: 'https://example.test/clip.mp4' })), exportUrl: 'https://example.test/ad.mp4' };
    const next = updateScene(p, p.scenes[0].id, 'New scene');
    expect(next.scenes[0].approved).toBe(false);
    expect(next.scenes[0].clipUrl).toBeUndefined();
    expect(next.scenes[0].history.at(-1)?.prompt).toBe(p.scenes[0].prompt);
    expect(next.scenes[1]).toEqual(p.scenes[1]);
    expect(next.exportUrl).toBeUndefined();
    expect(p.scenes[0].clipUrl).toBeDefined();
  });
  it('requires unlock before editing', () => {
    const p = newProject('Test');
    p.scenes[0].locked = true;
    expect(() => updateScene(p, p.scenes[0].id, 'Changed')).toThrow(/unlock/i);
  });
});
describe('quotes', () => {
  function approved() { let p = newProject('Test'); for (const s of p.scenes) p = approveScene(p, s.id); return p; }
  it('requires every frame approved', () => expect(() => createQuote(newProject('Test'), 'professional', 1000)).toThrow(/approv/i));
  it('binds to scene versions and expires', () => {
    const p = approved(); const q = createQuote(p, 'professional', 1000);
    expect(() => assertQuote(p, q, 1001)).not.toThrow();
    expect(() => assertQuote(p, q, q.expiresAt)).toThrow(/expired/i);
    expect(() => assertQuote(updateScene(p, p.scenes[0].id, 'Changed'), q, 1001)).toThrow();
  });
  it('rejects noninteger credits and reservations that exceed balance', () => {
    expect(() => reserve({ available: 100, held: 0, spent: 0, operations: [] }, 101, 'a')).toThrow();
    expect(() => reserve({ available: 100, held: 0, spent: 0, operations: [] }, 1.5, 'a')).toThrow();
  });
  it('is idempotent for duplicate reserve and release/settle', () => {
    const wallet = { available: 200, held: 0, spent: 0, operations: [] };
    const held = reserve(wallet, 100, 'job');
    expect(reserve(held, 100, 'job')).toEqual(held);
    const released = finish(held, 100, 'job', false);
    expect(released.available).toBe(200);
    expect(finish(released, 100, 'job', false)).toEqual(released);
    expect(() => finish(released, 100, 'job', true)).toThrow();
  });
  it('does not allow settlement without matching reservation', () => {
    expect(() => finish({ available: 100, held: 100, spent: 0, operations: [] }, 100, 'other', true)).toThrow();
  });
});
describe('character candidate rules', () => {
  it('uses 0, 3, or 2 choices per role with at most two roles', () => {
    expect(roleCandidates(0)).toBe(0); expect(roleCandidates(1)).toBe(3); expect(roleCandidates(2)).toBe(2);
    expect(() => roleCandidates(3)).toThrow();
  });
});
