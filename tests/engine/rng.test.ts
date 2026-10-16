import { describe, expect, it } from 'vitest';
import { COMBAT_SALT, combatRng, combatSeed, mulberry32 } from '../../src/systems/rng';
import { dailySeed } from '../../src/state/profile';

// The seeded combat rng (docs/item-hooks-refactor.md §5, phase 3): per aisle, from the run seed, and separate from `flow.rng`.

const take = (r: () => number, n: number) => Array.from({ length: n }, () => r());

describe('combatRng', () => {
  it('is reproducible: the same run seed and aisle give the same stream', () => {
    expect(take(combatRng(1234, 3), 50)).toEqual(take(combatRng(1234, 3), 50));
  });

  it('every aisle and every run gets its own stream', () => {
    const streams = new Set<string>();
    for (const seed of [1, 2, 3, 0xdeadbeef]) for (let aisle = 0; aisle < 12; aisle++) streams.add(take(combatRng(seed, aisle), 4).join());
    expect(streams.size).toBe(4 * 12);
  });

  it('seeds are unsigned 32-bit and never the bare run seed (so it never equals flow.rng\'s stream)', () => {
    for (const seed of [0, 1, 7, 0xffffffff, dailySeed('2026-10-16')]) for (const aisle of [0, 1, 9]) {
      const s = combatSeed(seed, aisle);
      expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
      expect(s).not.toBe(seed >>> 0);
    }
    expect(take(combatRng(5, 0), 5)).not.toEqual(take(mulberry32(5), 5));
    expect(COMBAT_SALT).not.toBe(0);
  });

  it('values are uniform enough: in [0,1), mean near 0.5', () => {
    const v = take(combatRng(77, 1), 5000);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...v)).toBeLessThan(1);
    expect(v.reduce((a, b) => a + b, 0) / v.length).toBeGreaterThan(0.47);
    expect(v.reduce((a, b) => a + b, 0) / v.length).toBeLessThan(0.53);
  });

  it('a daily run rolls the same combat numbers on every play', () => {
    const seed = dailySeed('2026-10-16');
    expect(take(combatRng(seed, 4), 20)).toEqual(take(combatRng(dailySeed('2026-10-16'), 4), 20));
    expect(take(combatRng(seed, 4), 20)).not.toEqual(take(combatRng(dailySeed('2026-10-17'), 4), 20));
  });
});

describe('independence from flow.rng', () => {
  it('drawing combat numbers never changes what flow.rng gives next (shop rolls, spawns, kill coins)', () => {
    const seed = 424242;
    const alone = mulberry32(seed);
    const flowSolo = take(alone, 100);
    const flow = mulberry32(seed), combat = combatRng(seed, 2);
    const interleaved: number[] = [];
    for (let i = 0; i < 100; i++) {
      take(combat, i % 7); // a varying amount of combat rolls between flow draws
      interleaved.push(flow());
    }
    expect(interleaved).toEqual(flowSolo);
  });
});

const sources = import.meta.glob('../../src/scenes/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const source = (name: string): string => sources[`../../src/scenes/${name}.ts`];

describe('Math.random in gameplay code', () => {
  // Every remaining Math.random in the arena files must be visible-only (particles, sound pitch, sprite wobble): the line has to say so.
  const files = ['ArenaScene', 'weapons', 'enemies', 'hazards', 'events', 'cartCombos'];
  const cosmetic = /\bfx\.|\bplay\(|animT|rotation:/;
  it.each(files)('%s only uses Math.random for cosmetics', (file) => {
    const bad = source(file).split('\n').map((l, i) => [i + 1, l] as const).filter(([, l]) => l.includes('Math.random') && !cosmetic.test(l));
    expect(bad).toEqual([]);
  });
  it('no scene file reads flow.rng for a roll that belongs to combat (statuses, crits, AI)', () => {
    // flow.rng stays for shop-adjacent rolls: spawn plan, kill coins, event picks, crates. weapons.ts and enemies.ts roll combat only.
    for (const f of ['weapons', 'enemies', 'hazards', 'cartCombos']) expect(source(f)).not.toMatch(/flow\.rng/);
  });
});
