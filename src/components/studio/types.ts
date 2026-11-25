import type { Project } from '@/lib/domain/schema';
export type StepProps = { project: Project; change: (project: Project) => void; run: (scope: string, targetId?: string) => void; busy: boolean };
