import { describe, expect, it } from 'vitest';
import { BALANCE_CONFIG, UNMODELLED, UNMODELLED_COMBOS, analyze, toMarkdown } from '../../src/buildlab/balance';
import { evalPairs, evolve, runFitness } from '../../src/buildlab/evolve';
import type { EvolveResult, HeldOut } from '../../src/buildlab/evolve';
import { greedyGenome } from '../../src/buildlab/genome';
import type { RunRecord } from '../../src/buildlab/report';
import { ITEM_ORDER, RECIPE_ORDER } from '../../src/engine/define';

const tiny = { seed: 3, pop: 4, gens: 2, seedsPerEval: 2, topK: 2, heldOut: 2, control: 2 };

describe('evolve', () => {
  it('is deterministic for the same options', () => {
    const a = evolve(tiny), b = evolve(tiny);
    const strip = (r: EvolveResult) => JSON.stringify({ g: r.generations, top: r.top, h: r.heldOut.top.map((h) => [h.label, h.fitness, h.winRate]), c: r.heldOut.control.map((h) => h.fitness), gr: r.heldOut.greedy.fitness });
    expect(strip(a)).toBe(strip(b));
    expect(evolve({ ...tiny, seed: 4 }).generations).not.toEqual(a.generations);
  });

  it('never loses its best genome (elitism), and reports every generation', () => {
    const seen: number[] = [];
    const r = evolve({ ...tiny, gens: 3, onGeneration: (g) => seen.push(g.gen) });
    expect(seen).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < r.generations.length; i++) expect(r.generations[i].best).toBeGreaterThanOrEqual(r.generations[i - 1].best);
    expect(r.generations[0].evaluated).toBe(4);
    expect(r.top.length).toBeGreaterThan(0);
    expect(r.heldOut.top).toHaveLength(r.top.length);
    expect(r.heldOut.control).toHaveLength(2);
    expect(r.heldOut.greedy.label).toBe('greedy');
  });

  it('uses the same evaluation pairs for every genome and rotates characters', () => {
    const p = evalPairs(1, 8, ['toaster', 'pan'], ['toaster']);
    expect(p.map((x) => x.starter)).toEqual(['toaster', 'pan', 'toaster', 'pan', 'toaster', 'pan', 'toaster', 'pan']);
    expect(evalPairs(1, 8, ['toaster', 'pan'], ['toaster'])).toEqual(p);
  });

  it('fitness rewards progress and a win', () => {
    const base = fake({ items: [], result: 'dead', diedAt: 3 });
    expect(runFitness(fake({ items: [], result: 'dead', diedAt: 5 }))).toBeGreaterThan(runFitness(base));
    expect(runFitness(fake({ items: [], result: 'win' }))).toBeGreaterThan(runFitness(fake({ items: [], result: 'dead', diedAt: 7 })));
  });
});

interface FakeOpts { items: string[]; combos?: string[]; sets?: Record<string, number>; result: 'win' | 'dead'; diedAt?: number; starter?: string; dealt?: number; by?: Record<string, number>; reactions?: Record<string, number>; acquired?: string[] }
function fake(o: FakeOpts): RunRecord {
  return {
    seed: 1, starter: o.starter ?? 'toaster', weapon: 'toaster', shift: 0, theme: 'main', result: o.result, ...(o.result === 'dead' ? { diedAt: o.diedAt ?? 4 } : {}),
    aislesPlayed: o.result === 'win' ? 8 : o.diedAt ?? 4, kills: 0, coinsEarned: 0,
    aisles: [{ aisle: 1, kind: 'fight', combos: [], sets: {}, weapons: 1, spawned: 10, kills: 5, hpAfter: 5, dealt: o.dealt ?? 100, damage: { bySource: o.by ?? {}, reactions: o.reactions ?? {}, byType: {} } }] as unknown as RunRecord['aisles'],
    acquired: (o.acquired ?? o.items).map((item) => ({ item, tier: 1, from: 'shop' as const })),
    finalBuild: { items: o.items.map((id, i) => ({ id, tier: 1, x: i, y: 0, rot: 0 })), shelf: [], combos: o.combos ?? [], sets: o.sets ?? {}, cartSize: [4, 3], maxHp: 10 },
    shopLog: [],
  };
}
const held = (label: string, runs: RunRecord[]): HeldOut => ({ label, genome: greedyGenome(), fitness: 1, winRate: runs.filter((r) => r.result === 'win').length / runs.length, avgAisle: 4, runs });
const many = (n: number, f: (i: number) => RunRecord): RunRecord[] => Array.from({ length: n }, (_, i) => f(i));

describe('balance', () => {
  const synthetic = () => {
    // top: every run holds fan + a combo and wins, never holds ice or bell; control: some hold fan / ice / bell and lose
    const topRuns = many(12, () => fake({ items: ['toaster', 'fan'], combos: ['toastMode'], sets: { kitchen: 2 }, result: 'win', by: { toaster: 60, fan: 0 }, reactions: { shatter: 2 } }));
    const ctrlRuns = many(10, (i) => fake({ items: i < 2 ? ['toaster', 'fan'] : i < 5 ? ['toaster', 'ice', 'bell'] : ['toaster'], result: 'dead', diedAt: 3 }));
    const res = {
      options: { ...tiny, shift: 0, theme: 'main' as const, pool: 'all' as const, starters: ['toaster' as const], weapons: ['toaster' as const] },
      generations: [{ gen: 0, best: 1, mean: 0.5, bestWinRate: 0, bestAvgAisle: 2, evaluated: 4 }],
      heldOut: { top: [held('top1', topRuns.slice(0, 6)), held('top2', topRuns.slice(6))], control: [held('random1', ctrlRuns)], greedy: held('greedy', ctrlRuns.slice(0, 4)) },
      durationMs: 1234,
    };
    return analyze(res, 'syn');
  };

  it('flags dominant and dead items, and never flags the unmodelled ones', () => {
    const b = synthetic();
    const row = (id: string) => b.items.find((i) => i.id === id)!;
    expect(row('fan').dominant).toBe(true);
    expect(row('fan').heldTop).toBe(1);
    expect(row('fan').heldControl).toBe(0.2);
    expect(row('fan').lift).toBe(5);
    expect(row('fan').dead).toBe(false);
    expect(row('ice').dead).toBe(true);
    expect(row('ice').dominant).toBe(false);
    expect(row('bell').dead).toBe(false);
    expect(row('bell').modelled).toBe(false);
    expect(row('toaster').dominant).toBe(false); // held everywhere: lift 1
    expect(row('toaster').damageShare).toBe(0.6);
    expect(b.items.map((i) => i.id)).toEqual([...ITEM_ORDER]);
    expect(b.items.filter((i) => i.dead).map((i) => i.id)).toEqual(['ice']);
  });

  it('reports combos, sets, reactions and win rates', () => {
    const b = synthetic();
    const combo = b.combos.find((c) => c.id === 'toastMode')!;
    expect(combo.formTop).toBe(1);
    expect(combo.formControl).toBe(0);
    expect(combo.dominant).toBe(true);
    expect(b.combos).toHaveLength(RECIPE_ORDER.length);
    expect(b.combos.find((c) => c.id === 'tailwind')!.unmodelled).toBeTruthy();
    expect(b.sets.find((s) => s.id === 'kitchen')!.levels).toEqual([1, 1, 0]);
    expect(b.reactions.find((r) => r.id === 'shatter')).toMatchObject({ totalTop: 24, perRunTop: 2, perRunControl: 0 });
    expect(b.groups.top.winRate).toBe(1);
    expect(b.groups.control.winRate).toBe(0);
    expect(b.builds).toHaveLength(BALANCE_CONFIG.topBuilds);
    expect(b.starters[0]).toMatchObject({ starter: 'toaster', bestWinRate: 1, greedyWinRate: 0 });
  });

  it('only lists items the proxy really cannot model', () => {
    for (const id of Object.keys(UNMODELLED)) expect(ITEM_ORDER as readonly string[]).toContain(id);
    for (const id of Object.keys(UNMODELLED_COMBOS)) expect(RECIPE_ORDER as readonly string[]).toContain(id);
  });

  it('writes a Markdown report with every section and findings built from the flags', () => {
    const b = synthetic(), md = toMarkdown(b);
    for (const h of ['# Build-lab balance report: syn', '## Findings', '## Held-out results', '## Evolution', '## Items', '## Combos', '## Sets', '## Reactions', '## Starters', '## Top 5 final builds', '## What the optimizer changed']) expect(md, h).toContain(h);
    expect(md).toContain('| fan |');
    expect(md).toContain('**dominant**');
    expect(md).toContain('**dead**');
    expect(b.findings.some((f) => f.startsWith('Dominant items') && f.includes('fan'))).toBe(true);
    expect(b.findings.some((f) => f.startsWith('Dead items') && f.includes('ice'))).toBe(true);
    expect(b.findings.some((f) => f.startsWith('Not modelled'))).toBe(true);
    expect(JSON.parse(JSON.stringify(b)).items).toHaveLength(ITEM_ORDER.length);
  });

  it('produces a report from a real tiny evolution', () => {
    const b = analyze(evolve(tiny), 'tiny');
    expect(b.items).toHaveLength(ITEM_ORDER.length);
    expect(toMarkdown(b)).toContain('## Findings');
  });
});
