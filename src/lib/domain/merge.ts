import { canonical } from './hash';
import { roleCandidates, stepBlocker, validateAnalysis, currentSheet } from './project';
import { projectSchema, type Project, type Scene } from './schema';

export class ConflictError extends Error { constructor(message = 'This project changed in another tab or device. Reload to continue.') { super(message); } }

/**
 * Applies a client's draft edits onto the server's stored project. Everything the client must not control
 * (assets, approvals, versions, history, status, jobs, QA, sample flag, analysis source/duration) is taken
 * from `stored`. Throws on structurally invalid edits rather than silently repairing them.
 */
export function mergeClientEdits(stored: Project, raw: unknown, opts: { requireSheets: boolean }): Project {
  const incoming = projectSchema.parse(raw);
  if (incoming.id !== stored.id) throw new Error('Project mismatch.');
  const now = new Date().toISOString();

  // Analysis: only editable once the server produced one; provenance and duration are server facts.
  let analysis = stored.analysis;
  if (stored.analysis && incoming.analysis) {
    analysis = { ...incoming.analysis, source: stored.analysis.source, durationMs: stored.analysis.durationMs };
    validateAnalysis(analysis);
  }
  const roles = analysis?.roles ?? [];
  const perRole = roleCandidates(roles.length);

  const candidates = incoming.candidates.filter(c => roles.some(r => r.id === c.roleId));
  for (const r of roles) if (candidates.filter(c => c.roleId === r.id).length > perRole) throw new Error('Too many identity options for a role.');
  if (new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error('Duplicate identity options.');

  const selections: Record<string, string> = {};
  for (const [roleId, cid] of Object.entries(incoming.selections)) {
    if (!roles.some(r => r.id === roleId) || !candidates.some(c => c.id === cid && c.roleId === roleId)) continue;
    if (opts.requireSheets && !currentSheet(stored, cid)) throw new Error('Create the identity sheet before selecting this identity.');
    selections[roleId] = cid;
  }

  if (new Set(incoming.scenes.map(s => s.id)).size !== incoming.scenes.length) throw new Error('Duplicate scenes.');
  const scenes: Scene[] = incoming.scenes.map(s => {
    if (s.roleIds.some(r => !roles.some(x => x.id === r))) throw new Error('A scene refers to a role that does not exist.');
    const prev = stored.scenes.find(x => x.id === s.id);
    if (!prev) return { ...s, version: 1, history: [], approval: null };
    const substantive = prev.prompt !== s.prompt || prev.seconds !== s.seconds || canonical(prev.roleIds) !== canonical(s.roleIds);
    if (substantive && prev.locked && s.locked) throw new Error('Unlock this scene before editing.');
    return {
      ...prev, title: s.title, prompt: s.prompt, seconds: s.seconds, roleIds: s.roleIds, locked: s.locked,
      version: substantive ? prev.version + 1 : prev.version,
      history: substantive ? [...prev.history, { version: prev.version, prompt: prev.prompt, seconds: prev.seconds, at: now }].slice(-200) : prev.history,
    };
  });
  // Removing a locked scene is not allowed.
  for (const prev of stored.scenes) if (prev.locked && !scenes.some(s => s.id === prev.id)) throw new Error('Unlock this scene before removing it.');

  const merged: Project = {
    ...stored, name: incoming.name, rights: incoming.rights, analysis, candidates, selections, brief: incoming.brief, scenes, step: stored.step,
  };
  let step = incoming.step;
  while (step > 0 && stepBlocker(merged, step)) step--;
  return projectSchema.parse({ ...merged, step });
}
