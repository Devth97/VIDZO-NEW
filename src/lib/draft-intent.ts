/**
 * What someone typed into the creation composer before a project exists (e.g. before sign-in).
 * Kept only in this tab's sessionStorage — never in a URL, analytics event or generation request —
 * and consumed once when the workspace opens. Every field maps to a real project/brief field.
 */
export const objectives = ['Product launch', 'Brand awareness', 'Offer promotion', 'Product education'] as const;
export type Objective = typeof objectives[number];
export type DraftIntent = { name: string; objective: Objective; brand: string; product: string };

const KEY = 'vidzo:starting-draft';
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export function parseDraftIntent(raw: string | null): DraftIntent | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<DraftIntent>;
    return { name: clip(o.name, 100), objective: objectives.includes(o.objective as Objective) ? (o.objective as Objective) : 'Product launch', brand: clip(o.brand, 100), product: clip(o.product, 200) };
  } catch {
    // Earlier versions stored the project name as a plain string.
    return { name: clip(raw, 100), objective: 'Product launch', brand: '', product: '' };
  }
}

export function saveDraftIntent(intent: DraftIntent): boolean {
  try { sessionStorage.setItem(KEY, JSON.stringify(intent)); return true; } catch { return false; }
}

export function takeDraftIntent(): DraftIntent | null {
  try { const v = parseDraftIntent(sessionStorage.getItem(KEY)); sessionStorage.removeItem(KEY); return v; } catch { return null; }
}
