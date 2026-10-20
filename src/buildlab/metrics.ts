import { reached, type AisleRecord, type FinalBuild, type RunRecord, type ShopLogEntry } from './report';

// The structural numbers the mechanics review compared (docs/buildlab.md, "Mechanics metrics"), computed from a build-lab report.

type MetricsRun = Pick<RunRecord, 'result' | 'diedAt' | 'aislesPlayed' | 'merges' | 'rerolls' | 'sells'> & {
  aisles: Pick<AisleRecord, 'aisle' | 'kind' | 'damageTaken' | 'weapons'>[];
  finalBuild: Pick<FinalBuild, 'combos' | 'sets'> & { items: { tier: number }[]; shelf: { tier: number }[] };
  shopLog: Pick<ShopLogEntry, 'shop' | 'moneyIn'>[];
};

/** The parts of a build-lab report the metrics read. A whole `Report` fits. */
export interface MetricsInput { runs: MetricsRun[] }

export interface AisleMetrics {
  /** Runs that played the aisle. */
  reached: number;
  deaths: number;
  /** This aisle's share of all deaths. */
  deathShare: number;
  /** Deaths among the runs that reached the aisle. */
  deathRate: number;
  /** Mean HP lost in the aisle's fights; null when every run there took a stockroom. */
  hpLost: number | null;
}

export interface Metrics {
  runs: number;
  winRate: number;
  /** Standard error of the win rate, sqrt(p (1 - p) / runs). */
  winRateSE: number;
  avgAisleReached: number;
  mergesPerRun: number;
  /** ★2 / ★3 items at run end, cart and shelf. */
  star2: number;
  star2PerRun: number;
  star3: number;
  star3PerRun: number;
  combosPerRun: number;
  /** Combos active at the end of at least one run: the keys of `comboRate`. */
  distinctCombos: number;
  /** Weapons in the cart for the final aisle. No shop follows it, so this is the run-end cart. */
  weaponsPerRun: number;
  rerollsPerRun: number;
  sellsPerRun: number;
  byAisle: Record<string, AisleMetrics>;
  /** Mean coins on entering shop k, over the runs that got there. */
  coinsAtShop: Record<string, number>;
  /** Share of runs with the combo active at run end. */
  comboRate: Record<string, number>;
  /** Share of runs whose final build has the set at level 2 or more, and at level 3. */
  setRate: Record<string, { lv2: number; lv3: number }>;
}

const at = <K, V>(m: Map<K, V>, k: K, init: () => V): V => m.get(k) ?? m.set(k, init()).get(k)!;
const byNumber = <T>(m: Map<number, T>): [string, T][] => [...m].sort(([a], [b]) => a - b).map(([k, v]) => [String(k), v]);
const byName = <T>(m: Map<string, T>): [string, T][] => [...m].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

export function computeMetrics(report: MetricsInput): Metrics {
  const runs = report.runs, n = runs.length;
  const sum = (f: (r: MetricsRun) => number): number => runs.reduce((a, r) => a + f(r), 0);
  const atTier = (r: MetricsRun, tier: number): number => [...r.finalBuild.items, ...r.finalBuild.shelf].filter((i) => i.tier === tier).length;

  const aisles = new Map<number, { reached: number; deaths: number; fights: number; hp: number }>();
  const aisle = (k: number) => at(aisles, k, () => ({ reached: 0, deaths: 0, fights: 0, hp: 0 }));
  const shops = new Map<number, { visits: number; coins: number }>();
  const combos = new Map<string, number>(), sets = new Map<string, { lv2: number; lv3: number }>();
  for (const r of runs) {
    for (const a of r.aisles) {
      const x = aisle(a.aisle);
      x.reached++;
      if (a.kind !== 'stockroom') { x.fights++; x.hp += a.damageTaken; }
    }
    if (r.result === 'dead') aisle(reached(r)).deaths++;
    for (const e of r.shopLog) {
      const s = at(shops, e.shop, () => ({ visits: 0, coins: 0 }));
      s.visits++;
      s.coins += e.moneyIn;
    }
    for (const c of r.finalBuild.combos) combos.set(c, (combos.get(c) ?? 0) + 1);
    for (const [id, lv] of Object.entries(r.finalBuild.sets)) {
      const s = at(sets, id, () => ({ lv2: 0, lv3: 0 }));
      if (lv >= 2) s.lv2++;
      if (lv >= 3) s.lv3++;
    }
  }

  const wins = runs.filter((r) => r.result === 'win').length, deaths = n - wins, winRate = wins / n;
  const star2 = sum((r) => atTier(r, 2)), star3 = sum((r) => atTier(r, 3));
  return {
    runs: n,
    winRate,
    winRateSE: Math.sqrt((winRate * (1 - winRate)) / n),
    avgAisleReached: sum(reached) / n,
    mergesPerRun: sum((r) => r.merges) / n,
    star2, star2PerRun: star2 / n,
    star3, star3PerRun: star3 / n,
    combosPerRun: sum((r) => r.finalBuild.combos.length) / n,
    distinctCombos: combos.size,
    weaponsPerRun: sum((r) => r.aisles[r.aisles.length - 1].weapons) / n,
    rerollsPerRun: sum((r) => r.rerolls) / n,
    sellsPerRun: sum((r) => r.sells) / n,
    byAisle: Object.fromEntries(byNumber(aisles).map(([k, a]) => [k, {
      reached: a.reached, deaths: a.deaths, deathShare: deaths ? a.deaths / deaths : 0, deathRate: a.deaths / a.reached, hpLost: a.fights ? a.hp / a.fights : null,
    }])),
    coinsAtShop: Object.fromEntries(byNumber(shops).map(([k, s]) => [k, s.coins / s.visits])),
    comboRate: Object.fromEntries(byName(combos).map(([k, c]) => [k, c / n])),
    setRate: Object.fromEntries(byName(sets).map(([k, s]) => [k, { lv2: s.lv2 / n, lv3: s.lv3 / n }])),
  };
}
