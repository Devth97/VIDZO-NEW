import { stepBlocker } from '@/lib/domain/project';
import { steps, type Project } from '@/lib/domain/schema';

/** The honest next step for a project, derived from the same rules the studio enforces. */
export function nextAction(p: Project): string {
  if (p.status === 'generating') return 'In production — check progress';
  if (p.status === 'analyzing') return 'Analysing your reference';
  if (p.status === 'review') return 'Review your clips';
  if (p.status === 'ready') return 'Ready to download';
  if (p.status === 'failed') return 'A job needs attention';
  if (p.step >= 6) return 'Request final assembly';
  return stepBlocker(p, p.step + 1) ?? `Continue to ${steps[p.step + 1]}`;
}
