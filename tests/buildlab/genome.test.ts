import { describe, expect, it } from 'vitest';
import { GENOME_SPEC, crossover, distance, genomeFromJSON, genomePolicy, greedyGenome, mutate, randomGenome } from '../../src/buildlab/genome';
import { runBatch, playRun, runSeed } from '../../src/buildlab/run';
import { mulberry32 } from '../../src/systems/rng';
import { ITEM_ORDER, RECIPE_ORDER, SET_ORDER } from '../../src/engine/define';

const inBounds = (g: ReturnType<typeof greedyGenome>) => GENOME_SPEC.every((s) => g.p[s.key] >= s.min && g.p[s.key] <= s.max && (!s.int || Number.isInteger(g.p[s.key])));

describe('genome', { timeout: 30_000 }, () => {
  it('has a parameter for every item, combo and set', () => {
    const keys = new Set(GENOME_SPEC.map((s) => s.key));
    for (const id of ITEM_ORDER) expect(keys.has(`item.${id}`), id).toBe(true);
    for (const id of RECIPE_ORDER) expect(keys.has(`combo.${id}`), id).toBe(true);
    for (const id of SET_ORDER) expect(keys.has(`set.${id}`), id).toBe(true);
    expect(keys.size).toBe(GENOME_SPEC.length);
  });

  it('round-trips through JSON, and fills / clamps / drops what a file got wrong', () => {
    const g = randomGenome(mulberry32(1));
    expect(genomeFromJSON(JSON.parse(JSON.stringify(g)))).toEqual(g);
    const bad = genomeFromJSON({ p: { 'item.fan': 99, 'rule.maxRerolls': 2.6, nonsense: 5 } });
    expect(bad.p['item.fan']).toBe(3);
    expect(bad.p['rule.maxRerolls']).toBe(3);
    expect(bad.p.nonsense).toBeUndefined();
    expect(bad.p['item.fuel']).toBe(1);
    expect(genomeFromJSON(null)).toEqual(greedyGenome());
  });

  it('mutation and crossover stay in bounds, change something, and are deterministic', () => {
    let g = greedyGenome();
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const m = mutate(g, rng, i % 2 ? 0.5 : 0.05, 0.1);
      expect(inBounds(m)).toBe(true);
      expect(distance(m, g)).toBeGreaterThan(0);
      g = m;
    }
    expect(inBounds(crossover(randomGenome(rng), randomGenome(rng), rng))).toBe(true);
    expect(inBounds(randomGenome(rng))).toBe(true);
    expect(mutate(greedyGenome(), mulberry32(2), 0.2, 0.1)).toEqual(mutate(greedyGenome(), mulberry32(2), 0.2, 0.1));
    expect(distance(greedyGenome(), greedyGenome())).toBe(0);
  });

  it('the greedy genome plays exactly the greedy policy', () => {
    const strip = (r: ReturnType<typeof runBatch>) => JSON.stringify({ runs: r.runs, summary: r.summary });
    const a = runBatch({ seed: 7, runs: 6, starters: ['toaster', 'coupon'] });
    const b = runBatch({ seed: 7, runs: 6, starters: ['toaster', 'coupon'], policy: genomePolicy(greedyGenome(), 'greedy') });
    expect(strip(b)).toBe(strip(a));
  });

  it('a different genome plays differently, and its rerolls and sales go through the real rules', () => {
    const g = greedyGenome();
    Object.assign(g.p, { 'rule.maxRerolls': 3, 'rule.rerollWant': 3, 'rule.sellOn': 1, 'rule.sellMargin': 0, 'item.fan': 3, 'item.fuel': 0 });
    const recs = Array.from({ length: 6 }, (_, i) => playRun({ seed: runSeed(3, i), policy: genomePolicy(g) }));
    const steps = recs.flatMap((r) => r.shopLog.flatMap((s) => s.steps));
    expect(steps.some((s) => s.kind === 'reroll' && s.ok)).toBe(true);
    expect(recs.some((r) => r.finalBuild.items.some((i) => i.id === 'fuel'))).toBe(false); // weight 0: never bought (only a crate could bring it)
    const base = playRun({ seed: runSeed(3, 0) });
    expect(JSON.stringify(recs[0])).not.toBe(JSON.stringify(base));
  });
});
