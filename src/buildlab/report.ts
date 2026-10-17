import { BOSS_WAVE } from '../data/waves';
import type { AisleResult } from './combat';
import type { PROXY } from './combat';

// The build-lab output (docs/buildlab.md): the JSON shapes and the summary over many runs. Pure data, no rng, key order fixed, so the same
// seeds give byte-identical JSON (apart from `meta.durationMs` / `meta.gitRev`).

export interface ShopStep {
  kind: string;
  ok: boolean;
  item?: string;
  tier?: number;
  /** Coins spent (negative: earned, e.g. a sale). */
  cost?: number;
  reason?: string;
}

export interface ShopLogEntry {
  /** The shop after this aisle (1-based). */
  shop: number;
  hp: number;
  moneyIn: number;
  moneyOut: number;
  shopLevel: number;
  offers: { item: string; tier: number; price: number; double?: boolean; bought: boolean }[];
  steps: ShopStep[];
  /** The door taken afterwards. */
  door?: string;
}

export interface AisleRecord extends Omit<AisleResult, 'kind'> {
  kind: AisleResult['kind'] | 'stockroom';
  /** Combos active in the cart when the aisle started. */
  combos: string[];
  /** Set levels (> 0) in the cart when the aisle started. */
  sets: Record<string, number>;
  weapons: number;
  /** What the mini-boss crate / the stockroom gave. */
  loot?: { item: string; tier: number; offered: string[] };
}

export interface BuildItem { id: string; tier: number; x: number; y: number; rot: number }

export interface FinalBuild {
  items: BuildItem[];
  shelf: { id: string; tier: number }[];
  combos: string[];
  sets: Record<string, number>;
  cartSize: [number, number];
  maxHp: number;
}

export interface RunRecord {
  seed: number;
  starter: string;
  weapon: string;
  shift: number;
  theme: string;
  result: 'win' | 'dead';
  /** The aisle the run ended in (dead). */
  diedAt?: number;
  /** How it ended: killed by enemies, or a boss aisle that hit the time cap. */
  cause?: 'enemies' | 'stalled';
  /** Aisles played (the last one included). */
  aislesPlayed: number;
  kills: number;
  coinsEarned: number;
  aisles: AisleRecord[];
  /** Every item the run got hold of: the starter weapon, shop buys, crates, stockrooms. */
  acquired: { item: string; tier: number; from: 'start' | 'shop' | 'crate' | 'stockroom' }[];
  finalBuild: FinalBuild;
  shopLog: ShopLogEntry[];
}

export interface ReportMeta {
  seed: number;
  runs: number;
  starter: string;
  weapon: string;
  shift: number;
  theme: string;
  pool: string;
  policy: string;
  proxy: typeof PROXY;
  gitRev?: string;
  durationMs: number;
}

export interface RateBy { runs: number; winRate: number; avgAisleReached: number }

export interface Summary {
  runs: number;
  winRate: number;
  avgAisleReached: number;
  /** Share of runs that ever held the item (starter, buys, crates, stockrooms). */
  itemPickRate: Record<string, number>;
  /** Share of runs that had the item in the cart at the end. */
  itemFinalRate: Record<string, number>;
  /** Win rate among the runs that had the item in the cart at the end (dominance signal). */
  itemWinRate: Record<string, number>;
  /** Share of runs in which the combo was active at the start of at least one fight. */
  comboRate: Record<string, number>;
  comboWinRate: Record<string, number>;
  /** Per set: the share of runs that reached level 1, 2, 3 at the start of at least one fight. */
  setRate: Record<string, Record<string, number>>;
  /** Total times each element reaction went off, over all runs. */
  reactionTotals: Record<string, number>;
  /** Mean dps of the cart per aisle number (runs that played it). */
  avgDpsByAisle: Record<string, number>;
  avgDamageTakenByAisle: Record<string, number>;
  /** Runs that died in each aisle. */
  deathsByAisle: Record<string, number>;
  byStarter: Record<string, RateBy>;
}

export interface Report { meta: ReportMeta; runs: RunRecord[]; summary: Summary }

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const reached = (r: RunRecord): number => (r.result === 'win' ? BOSS_WAVE : r.diedAt ?? r.aislesPlayed);

function rate(runs: RunRecord[], has: (r: RunRecord) => boolean): { n: number; wins: number } {
  let n = 0, wins = 0;
  for (const r of runs) if (has(r)) { n++; if (r.result === 'win') wins++; }
  return { n, wins };
}

/** Aggregate runs. `order` lists the ids to report on (items, combos, sets): ids with no data are left out. */
export function summarize(runs: RunRecord[]): Summary {
  const N = Math.max(1, runs.length);
  const sortKeys = <T>(o: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const items = new Set<string>(), combos = new Set<string>(), sets = new Set<string>();
  for (const r of runs) {
    r.acquired.forEach((a) => items.add(a.item));
    r.finalBuild.items.forEach((i) => items.add(i.id));
    r.aisles.forEach((a) => { a.combos.forEach((c) => combos.add(c)); Object.keys(a.sets).forEach((s) => sets.add(s)); });
  }
  const itemPickRate: Summary['itemPickRate'] = {}, itemFinalRate: Summary['itemFinalRate'] = {}, itemWinRate: Summary['itemWinRate'] = {};
  for (const id of items) {
    itemPickRate[id] = r3(runs.filter((r) => r.acquired.some((a) => a.item === id)).length / N);
    const f = rate(runs, (r) => r.finalBuild.items.some((i) => i.id === id));
    itemFinalRate[id] = r3(f.n / N);
    if (f.n) itemWinRate[id] = r3(f.wins / f.n);
  }
  const comboRate: Summary['comboRate'] = {}, comboWinRate: Summary['comboWinRate'] = {};
  for (const id of combos) {
    const c = rate(runs, (r) => r.aisles.some((a) => a.combos.includes(id)));
    comboRate[id] = r3(c.n / N);
    if (c.n) comboWinRate[id] = r3(c.wins / c.n);
  }
  const setRate: Summary['setRate'] = {};
  for (const id of sets) {
    setRate[id] = {};
    for (const lv of [1, 2, 3]) setRate[id][String(lv)] = r3(runs.filter((r) => r.aisles.some((a) => (a.sets[id] ?? 0) >= lv)).length / N);
  }
  const reactionTotals: Record<string, number> = {}, dps: Record<string, number[]> = {}, taken: Record<string, number[]> = {}, deaths: Record<string, number> = {};
  for (const r of runs) {
    for (const a of r.aisles) {
      for (const [k, v] of Object.entries(a.damage.reactions)) reactionTotals[k] = (reactionTotals[k] ?? 0) + v;
      if (a.kind === 'stockroom') continue;
      (dps[a.aisle] ??= []).push(a.dps);
      (taken[a.aisle] ??= []).push(a.damageTaken);
    }
    if (r.result === 'dead') deaths[r.diedAt ?? r.aislesPlayed] = (deaths[r.diedAt ?? r.aislesPlayed] ?? 0) + 1;
  }
  const mean = (m: Record<string, number[]>): Record<string, number> => Object.fromEntries(Object.entries(m).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => [k, r3(v.reduce((a, b) => a + b, 0) / v.length)]));
  const byStarter: Record<string, RateBy> = {};
  for (const s of [...new Set(runs.map((r) => r.starter))]) {
    const rs = runs.filter((r) => r.starter === s);
    byStarter[s] = { runs: rs.length, winRate: r3(rs.filter((r) => r.result === 'win').length / rs.length), avgAisleReached: r3(rs.reduce((a, r) => a + reached(r), 0) / rs.length) };
  }
  return {
    runs: runs.length,
    winRate: r3(runs.filter((r) => r.result === 'win').length / N),
    avgAisleReached: r3(runs.reduce((a, r) => a + reached(r), 0) / N),
    itemPickRate: sortKeys(itemPickRate), itemFinalRate: sortKeys(itemFinalRate), itemWinRate: sortKeys(itemWinRate),
    comboRate: sortKeys(comboRate), comboWinRate: sortKeys(comboWinRate), setRate: sortKeys(setRate), reactionTotals: sortKeys(reactionTotals),
    avgDpsByAisle: mean(dps), avgDamageTakenByAisle: mean(taken), deathsByAisle: Object.fromEntries(Object.entries(deaths).sort(([a], [b]) => Number(a) - Number(b))),
    byStarter,
  };
}

/** The short human summary the CLI prints. */
export function formatSummary(s: Summary, meta: Pick<ReportMeta, 'runs' | 'starter' | 'seed' | 'durationMs'>): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const top = (m: Record<string, number>, n: number) => Object.entries(m).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([k, v]) => `${k} ${pct(v)}`).join(', ');
  const lines = [
    `build-lab: ${s.runs} runs (${meta.starter}), seed ${meta.seed}, ${(meta.durationMs / 1000).toFixed(2)} s = ${(s.runs / Math.max(meta.durationMs / 1000, 0.001)).toFixed(1)} runs/s`,
    `win rate ${pct(s.winRate)}, average aisle reached ${s.avgAisleReached.toFixed(2)} of ${BOSS_WAVE}`,
  ];
  for (const [k, v] of Object.entries(s.byStarter)) lines.push(`  ${k.padEnd(8)} runs ${String(v.runs).padStart(3)}  win ${pct(v.winRate).padStart(6)}  aisle ${v.avgAisleReached.toFixed(2)}`);
  lines.push(`deaths by aisle: ${Object.entries(s.deathsByAisle).map(([k, v]) => `${k}:${v}`).join(' ') || 'none'}`);
  lines.push(`dps by aisle: ${Object.entries(s.avgDpsByAisle).map(([k, v]) => `${k}:${v.toFixed(0)}`).join(' ')}`);
  lines.push(`most held at the end: ${top(s.itemFinalRate, 8)}`);
  lines.push(`combos: ${top(s.comboRate, 6) || 'none'}`);
  lines.push(`reactions: ${Object.entries(s.reactionTotals).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  return lines.join('\n');
}
