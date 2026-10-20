import { describe, expect, it } from 'vitest';
import { computeMetrics, type MetricsInput } from '../../src/buildlab/metrics';
import { runBatch } from '../../src/buildlab/run';

type Run = MetricsInput['runs'][number];
interface RunSpec {
  died?: number;
  /** HP lost per aisle, from aisle 1; 'stockroom' for a stockroom aisle. */
  hp: (number | 'stockroom')[];
  /** Coins on entering each shop, from shop 1. */
  coins: number[];
  merges: number; rerolls: number; sells: number;
  cart: number[]; shelf: number[];
  combos: string[]; sets: Record<string, number>;
  /** Weapons in the final aisle; every earlier aisle had 1. */
  weapons: number;
}
const run = (o: RunSpec): Run => ({
  result: o.died ? 'dead' : 'win', ...(o.died ? { diedAt: o.died } : {}), aislesPlayed: o.hp.length, merges: o.merges, rerolls: o.rerolls, sells: o.sells,
  aisles: o.hp.map((hp, i) => ({ aisle: i + 1, kind: hp === 'stockroom' ? 'stockroom' : 'fight', damageTaken: hp === 'stockroom' ? 0 : hp, weapons: i === o.hp.length - 1 ? o.weapons : 1 })),
  finalBuild: { items: o.cart.map((tier) => ({ tier })), shelf: o.shelf.map((tier) => ({ tier })), combos: o.combos, sets: o.sets },
  shopLog: o.coins.map((moneyIn, i) => ({ shop: i + 1, moneyIn })),
});

const fixture: MetricsInput = {
  runs: [
    run({ hp: [0, 3, 2, 10, 10, 10, 10, 20], coins: [20, 30, 40, 40, 40, 40, 40], merges: 3, rerolls: 2, sells: 1, cart: [3, 2], shelf: [2], combos: ['hotPlate', 'toastMode'], sets: { kitchen: 3, office: 1 }, weapons: 3 }),
    run({ died: 4, hp: [2, 6, 6, 30], coins: [26, 20, 10], merges: 1, rerolls: 0, sells: 0, cart: [2, 1], shelf: [], combos: ['toastMode'], sets: { kitchen: 2 }, weapons: 1 }),
    run({ died: 6, hp: [4, 'stockroom', 4, 20, 10, 40], coins: [24, 50, 20, 10, 0], merges: 0, rerolls: 1, sells: 1, cart: [1], shelf: [1], combos: [], sets: {}, weapons: 2 }),
  ],
};

describe('mechanics metrics', () => {
  it('computes the review numbers from a hand-written three-run report', () => {
    expect(computeMetrics(fixture)).toEqual({
      runs: 3,
      winRate: 1 / 3,
      winRateSE: expect.closeTo(Math.sqrt((1 / 3) * (2 / 3) / 3), 12),
      avgAisleReached: (8 + 4 + 6) / 3,
      mergesPerRun: (3 + 1 + 0) / 3,
      star2: 3, star2PerRun: 1,
      star3: 1, star3PerRun: 1 / 3,
      combosPerRun: (2 + 1 + 0) / 3,
      distinctCombos: 2,
      weaponsPerRun: (3 + 1 + 2) / 3,
      rerollsPerRun: (2 + 0 + 1) / 3,
      sellsPerRun: (1 + 0 + 1) / 3,
      byAisle: {
        1: { reached: 3, deaths: 0, deathShare: 0, deathRate: 0, hpLost: (0 + 2 + 4) / 3 },
        2: { reached: 3, deaths: 0, deathShare: 0, deathRate: 0, hpLost: (3 + 6) / 2 },
        3: { reached: 3, deaths: 0, deathShare: 0, deathRate: 0, hpLost: (2 + 6 + 4) / 3 },
        4: { reached: 3, deaths: 1, deathShare: 1 / 2, deathRate: 1 / 3, hpLost: (10 + 30 + 20) / 3 },
        5: { reached: 2, deaths: 0, deathShare: 0, deathRate: 0, hpLost: (10 + 10) / 2 },
        6: { reached: 2, deaths: 1, deathShare: 1 / 2, deathRate: 1 / 2, hpLost: (10 + 40) / 2 },
        7: { reached: 1, deaths: 0, deathShare: 0, deathRate: 0, hpLost: 10 },
        8: { reached: 1, deaths: 0, deathShare: 0, deathRate: 0, hpLost: 20 },
      },
      coinsAtShop: { 1: (20 + 26 + 24) / 3, 2: (30 + 20 + 50) / 3, 3: (40 + 10 + 20) / 3, 4: (40 + 10) / 2, 5: (40 + 0) / 2, 6: 40, 7: 40 },
      comboRate: { hotPlate: 1 / 3, toastMode: 2 / 3 },
      setRate: { kitchen: { lv2: 2 / 3, lv3: 1 / 3 }, office: { lv2: 0, lv3: 0 } },
    });
  });

  it('agrees with the lab summary on the numbers both report', () => {
    const rep = runBatch({ seed: 2, runs: 16 });
    const m = computeMetrics(rep), r3 = (n: number) => Math.round(n * 1000) / 1000;
    const aisles = Object.entries(m.byAisle);
    expect(rep.summary.deathsByAisle, 'the batch has deaths to compare').not.toEqual({});
    expect(r3(m.winRate)).toBe(rep.summary.winRate);
    expect(r3(m.avgAisleReached)).toBe(rep.summary.avgAisleReached);
    expect(Object.fromEntries(aisles.filter(([, a]) => a.deaths).map(([k, a]) => [k, a.deaths]))).toEqual(rep.summary.deathsByAisle);
    expect(Object.fromEntries(aisles.filter(([, a]) => a.hpLost !== null).map(([k, a]) => [k, r3(a.hpLost!)]))).toEqual(rep.summary.avgDamageTakenByAisle);
  });
});
