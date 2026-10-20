import type { Phase } from '../types';

// Pure tutorial step machine (no DOM): `advance` marks entries seen from a state snapshot, `pick` says which callout to show.
// Steps run in order; tips are one-shot contextual hints. Everything shown is non-blocking (see tutorial.ts).
export type TutPhase = 'combat' | 'shop' | 'route';
export interface Progress { done: boolean; seen: string[] }
export interface Snap {
  lab: boolean;
  phase: Phase;
  /** Id of the callout shown on the previous tick and for how long (ms) it has been visible. */
  shown: string | null;
  ms: number;
  kills: number;
  moved: boolean;
  dashed: boolean;
  moneyUp: boolean;
  bought: boolean;
  /** A weapon touches another item in the cart. */
  supported: boolean;
  mergePair: boolean;
  boss: boolean;
  flags: string[];
}
interface Entry { id: string; at: TutPhase; done: (s: Snap) => boolean; on?: (s: Snap) => boolean }

export const STEPS: Entry[] = [
  { id: 'move', at: 'combat', done: (s) => s.moved },
  { id: 'weapons', at: 'combat', done: (s) => s.kills >= 1 },
  { id: 'dash', at: 'combat', done: (s) => s.dashed },
  { id: 'coins', at: 'combat', done: (s) => s.moneyUp || s.ms >= 8000 },
  { id: 'survive', at: 'combat', done: (s) => s.ms >= 6000 },
  { id: 'buy', at: 'shop', done: (s) => s.bought },
  { id: 'place', at: 'shop', done: (s) => s.supported || s.ms >= 15000 },
  { id: 'combos', at: 'shop', done: (s) => s.ms >= 8000 },
  { id: 'door', at: 'route', done: (s) => s.phase !== 'route' && s.ms > 0 },
];
export const TIPS: Entry[] = [
  { id: 'merge', at: 'shop', on: (s) => s.mergePair, done: (s) => s.ms >= 8000 },
  { id: 'elite', at: 'combat', on: (s) => s.flags.includes('elite'), done: (s) => s.ms >= 7000 },
  { id: 'obstacles', at: 'combat', on: (s) => s.flags.includes('obstacles'), done: (s) => s.ms >= 7000 },
  { id: 'event', at: 'combat', on: (s) => s.flags.includes('event'), done: (s) => s.ms >= 7000 },
  { id: 'boss', at: 'combat', on: (s) => s.boss, done: (s) => s.ms >= 7000 },
];

const RANK: Record<TutPhase, number> = { combat: 0, shop: 1, route: 2 };
const tutPhase = (p: Phase): TutPhase | null => (p === 'checkout' ? 'combat' : p === 'combat' || p === 'shop' || p === 'route' ? p : null);

const OWN = new Set([...STEPS, ...TIPS].map((e) => e.id));
/** Replay: steps and tips start over. Ids in `seen` the tutorial does not own (the systems a profile has met, state/disclosure.ts) are kept. */
export const freshProgress = (seen: string[] = []): Progress => ({ done: false, seen: seen.filter((id) => !OWN.has(id)) });
/** Skip: every step and tip counts as seen, other ids in `seen` are kept. */
export const skipAll = (seen: string[] = []): Progress => ({ done: true, seen: [...freshProgress(seen).seen, ...OWN] });

/** The callout to show right now (a step if its phase matches, else a triggered tip), or null. Never in the Test Lab. */
export function pick(p: Progress, s: Snap): { id: string; tip: boolean } | null {
  const ph = tutPhase(s.phase);
  if (s.lab || !ph) return null;
  const step = p.done ? undefined : STEPS.find((e) => !p.seen.includes(e.id));
  if (step?.at === ph) return { id: step.id, tip: false };
  const tip = TIPS.find((e) => e.at === ph && !p.seen.includes(e.id) && e.on!(s));
  return tip ? { id: tip.id, tip: true } : null;
}

/** Marks the shown entry seen once its condition holds; steps the player has outrun (e.g. combat steps once in the shop) are skipped. */
export function advance(p: Progress, s: Snap): Progress {
  const ph = tutPhase(s.phase);
  if (s.lab || !ph) return p;
  let seen = p.seen;
  for (const e of STEPS) if (!seen.includes(e.id) && RANK[e.at] < RANK[ph]) seen = [...seen, e.id];
  // judge what is on screen and what was shown a tick ago (the door step ends when the route screen closes)
  for (const id of new Set([pick({ ...p, seen }, s)?.id, s.shown])) {
    const cur = [...STEPS, ...TIPS].find((e) => e.id === id);
    if (cur && !seen.includes(cur.id) && cur.done({ ...s, ms: id === s.shown ? s.ms : 0 })) seen = [...seen, cur.id];
  }
  const done = p.done || STEPS.every((e) => seen.includes(e.id));
  return seen === p.seen && done === p.done ? p : { done, seen };
}
