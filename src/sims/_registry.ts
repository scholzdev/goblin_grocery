import { validateSim, type SimDef } from './_sim';

// Collects every sim file (src/sims/<id>.ts, default export). Adding a file is the only registration there is.
// Files starting with `_` are helpers and not collected.

export interface SimRegistry {
  /** Every sim id (file name), sorted. */
  ids: string[];
  get(id: string): SimDef | undefined;
  /** Problems of all sims, one line each, prefixed with the sim id (empty = every sim is valid). */
  problems: string[];
  /** Problems of one sim. */
  problemsOf(id: string): string[];
}

const baseName = (path: string): string => (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '');

/** Builds the registry from `{ path: default export }` (filename = id). Does not throw: a broken sim is reported, not dropped. */
export function createSimRegistry(files: Record<string, unknown>): SimRegistry {
  const sims = new Map<string, SimDef>();
  const problems = new Map<string, string[]>();
  for (const [path, mod] of Object.entries(files)) {
    const id = baseName(path);
    if (!mod || typeof mod !== 'object' || !('cart' in mod)) { problems.set(id, [`${path} has no default export from defineSim({...})`]); continue; }
    sims.set(id, mod as SimDef);
    problems.set(id, validateSim(mod as SimDef, id));
  }
  const ids = [...new Set([...sims.keys(), ...problems.keys()])].sort();
  return {
    ids,
    get: (id) => sims.get(id),
    problems: ids.flatMap((id) => (problems.get(id) ?? []).map((p) => `${id}: ${p}`)),
    problemsOf: (id) => problems.get(id) ?? [],
  };
}

export const simRegistry: SimRegistry = createSimRegistry(import.meta.glob<SimDef>(['./*.ts', '!./_*.ts'], { eager: true, import: 'default' }));
