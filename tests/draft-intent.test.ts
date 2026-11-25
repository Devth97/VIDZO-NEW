import { describe, expect, it } from 'vitest';
import { parseDraftIntent } from '../src/lib/draft-intent';

describe('creative direction handoff', () => {
  it('preserves the idea independently of the editable project name', () => {
    const draft = parseDraftIntent(JSON.stringify({ name: 'Launch film', direction: 'Show our product in use, with a new cast.', objective: 'Product launch', brand: 'Our brand', product: 'Our product' }));
    expect(draft).toMatchObject({ name: 'Launch film', direction: 'Show our product in use, with a new cast.', brand: 'Our brand', product: 'Our product' });
  });
  it('bounds stored ideas before they enter the draft form', () => {
    expect(parseDraftIntent(JSON.stringify({ direction: 'a'.repeat(3000) }))?.direction).toHaveLength(2000);
  });
  it('keeps older name-only drafts usable without inventing a direction', () => {
    expect(parseDraftIntent('My earlier project')).toMatchObject({ name: 'My earlier project' });
    expect(parseDraftIntent(JSON.stringify({ name: 'Old draft' }))?.direction).toBe('');
  });
});
