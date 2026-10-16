import { afterEach, describe, expect, it } from 'vitest';
import electric from '../../../src/content/sets/electric';
import { contentSet, contentSetTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import { pickRicochetTarget } from '../../../src/systems/combat';
import { mulberry32 } from '../../../src/systems/rng';
import type { WeaponStats } from '../../../src/types';
import { arena, at, far, full } from '../helpers';
import { draws, expectSetText, seedWhere } from './helpers';

afterEach(() => setLang('en'));

const TOASTER = at('toaster'); // an electrical weapon (toast)
// Electric members that touch nothing: Battery (module), Vacuum and Blender (electrical weapons elsewhere in the cart).
const MEMBERS = [far('battery'), far('vacuum'), far('blender')];
const cart = (n: number) => [TOASTER, ...MEMBERS.slice(0, n)];
const stats = (c: Parameters<typeof full>[0], i = 0) => full(c).weapons[i];

describe('Electric set: chain stats', () => {
  it('2 / 3 / 4 distinct electrical types give L1 / L2 / L3; the toaster alone is 1', () => {
    expect([0, 1, 2, 3].map((n) => full(cart(n)).sets.electric)).toEqual([0, 1, 2, 3]);
  });

  it('no chain below the threshold', () => {
    const w = stats(cart(0));
    expect([w.chainChance, w.chainJumps]).toEqual([0, 0]);
  });

  it('L1 10% to arc to 1 enemy, L2 20% to 2, L3 30% to 3 (per level, not replaced as a block)', () => {
    expect([1, 2, 3].map((n) => [stats(cart(n)).chainChance, stats(cart(n)).chainJumps])).toEqual([[0.1, 1], [0.2, 2], [0.3, 3]]);
  });

  it('every electrical weapon gets it (an aura too: the runtime skips its ticks), the Microwave never (it chains on its own)', () => {
    const b = full(cart(3));
    const by = (type: string) => b.weapons.find((w) => w.type === type)!;
    expect(by('toaster').chainChance).toBe(0.3);
    expect(by('vacuum').chainChance).toBe(0.3);
    expect(by('blender').chainChance).toBe(0.3);
    const micro = full([at('microwave'), far('battery'), far('vacuum')]);
    expect(micro.sets.electric).toBe(2); // microwave + battery + vacuum = 3 types: L2
    expect(micro.weapons.find((w) => w.type === 'microwave')!.chainChance).toBe(0);
    expect(micro.weapons.find((w) => w.type === 'vacuum')!.chainChance).toBe(0.2);
  });

  it('non-electrical weapons get nothing', () => {
    const pan = full([at('pan'), far('battery'), far('vacuum'), far('blender')]);
    expect(pan.sets.electric).toBe(2); // three electrical types, none of them the pan: L2
    expect(pan.weapons.find((w) => w.type === 'pan')!.chainChance).toBe(0);
  });
});

describe('Electric set: content', () => {
  it('is registered with its tune (L1/L2/L3 arrays for chance and jumps, flat range and damage share)', () => {
    expect(contentSet('electric')).toBe(electric);
    expect(contentSetTune('electric', 1)).toEqual({ chance: 0.1, jumps: 1, range: 120, damageMult: 0.5 });
    expect(contentSetTune('electric', 2)).toEqual({ chance: 0.2, jumps: 2, range: 120, damageMult: 0.5 });
    expect(contentSetTune('electric', 3)).toEqual({ chance: 0.3, jumps: 3, range: 120, damageMult: 0.5 });
  });

  it('runs at set order 60 (last of the weapon bonuses); its chain hook rolls after the Frost freeze (40 > 20)', () => {
    expect(electric.build).toMatchObject({ phase: 'set', order: 60 });
    expect(electric.hooks?.order).toBe(40);
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('electric', {
      en: { name: 'Electric', bonus: ['Electric hits: 10% chance to arc to 1 enemy for 50%', 'Electric hits: 20% chance to arc to 2 enemies for 50%', 'Electric hits: 30% chance to arc to 3 enemies for 50%'] },
      de: { name: 'Elektrisch', bonus: ['Elektro-Treffer: 10 % Chance auf Blitz zu 1 Gegner für 50 %', 'Elektro-Treffer: 20 % Chance auf Blitz zu 2 Gegnern für 50 %', 'Elektro-Treffer: 30 % Chance auf Blitz zu 3 Gegnern für 50 %'] },
    });
  });
});

// Runtime: `afterHit`. One roll per qualifying hit against the weapon's chainChance; each jump goes to the closest enemy not yet struck
// within the range of the one before, for half the hit's incoming damage, through the whole pipeline (as a `chained` hit).
describe('Electric set: arcs', () => {
  const field = (n: number, seed: number) => {
    const a = arena(cart(n), { seed });
    // A row of groceries 50 apart, and one far away: the chain walks along the row.
    const row = [0, 50, 100, 150].map((x) => a.fake.spawnEnemy({ hp: 1000, x, y: 0 }));
    const lone = a.fake.spawnEnemy({ hp: 1000, x: 900, y: 0 });
    return { ...a, row, lone };
  };
  const damages = (fake: ReturnType<typeof arena>['fake']) => fake.callsOf('damage').map((c) => [c.enemy, c.dmg, c.opts]);

  it('a lucky roll arcs to the closest enemies in turn: half the incoming damage each, chained, as many jumps as the level', () => {
    const seed = seedWhere((r) => r < 0.2);
    const { fake, stats: w, row } = field(2, seed);
    fake.hit(row[0], 10, w);
    expect(damages(fake)).toEqual([[row[1].id, 5, { chained: true, quiet: undefined }], [row[2].id, 5, { chained: true, quiet: undefined }]]);
    expect(fake.callsOf('fx').filter((c) => c.method === 'spark').map((c) => c.args)).toEqual([[50, -30, 4, 0x9be8ff], [100, -30, 4, 0x9be8ff]]);
    expect(fake.callsOf('fx').find((c) => c.method === 'arc')?.args[0]).toEqual([{ x: 0, y: -30 }, { x: 50, y: -30 }, { x: 100, y: -30 }]);
  });

  it('L3 jumps three times; L1 once', () => {
    const seed = seedWhere((r) => r < 0.1);
    const l3 = field(3, seed); l3.fake.hit(l3.row[0], 10, l3.stats);
    expect(l3.fake.callsOf('damage')).toHaveLength(3);
    const l1 = field(1, seed); l1.fake.hit(l1.row[0], 10, l1.stats);
    expect(l1.fake.callsOf('damage')).toHaveLength(1);
  });

  it('a miss does nothing and uses exactly one draw; the chained hits roll nothing of their own', () => {
    const seed = seedWhere((r) => r >= 0.2);
    const miss = field(2, seed); miss.fake.hit(miss.row[0], 10, miss.stats);
    expect(miss.fake.callsOf('damage')).toEqual([]);
    expect(miss.fake.rng()).toBe(draws(seed, 2)[1]);
    const lucky = seedWhere((r) => r < 0.2);
    const hit = field(2, lucky); hit.fake.hit(hit.row[0], 10, hit.stats);
    expect(hit.fake.rng()).toBe(draws(lucky, 2)[1]); // one draw for the whole arc: chained hits never chain again
  });

  it('stays within the set\'s range of the previous enemy and stops when nothing is left; no arc line then', () => {
    const seed = seedWhere((r) => r < 0.3);
    const a = arena(cart(3), { seed });
    const first = a.fake.spawnEnemy({ hp: 1000, x: 0, y: 0 });
    a.fake.spawnEnemy({ hp: 1000, x: 121, y: 0 }); // just out of the 120 range
    a.fake.hit(first, 10, a.stats);
    expect(a.fake.callsOf('damage')).toEqual([]);
    expect(a.fake.callsOf('fx').filter((c) => c.method === 'arc')).toEqual([]);
    const edge = arena(cart(3), { seed }), f2 = edge.fake.spawnEnemy({ hp: 1000, x: 0, y: 0 }), g2 = edge.fake.spawnEnemy({ hp: 1000, x: 120, y: 0 });
    edge.fake.hit(f2, 10, edge.stats);
    expect(edge.fake.callsOf('damage').map((c) => c.enemy)).toEqual([g2.id]); // exactly 120 is in range
  });

  it('direct hits only: no roll (no draw) for DoT, aura or puddle ticks, or hits that are already chained', () => {
    const { fake, stats: w, row } = field(3, 1);
    fake.hit(row[0], 1, w, { isDot: true });
    fake.hit(row[0], 1, { ...w, pattern: 'aura' });
    fake.hit(row[0], 1, { ...w, pattern: 'puddle' });
    fake.hit(row[0], 1, w, { chained: true });
    expect(fake.callsOf('damage')).toEqual([]);
    expect(fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('needs a weapon with a chain: a weaponless hit or a weapon without chainChance rolls nothing', () => {
    const { fake, row } = field(3, 1);
    fake.hit(row[0], 5, null, { label: 'shove' });
    fake.hit(row[0], 5, { ...stats(cart(3)), chainChance: 0 } as WeaponStats);
    expect(fake.rng()).toBe(draws(1, 1)[0]);
  });
});

describe('FakeCtx.ricochetTarget is the arena\'s pick', () => {
  it('agrees with systems/combat pickRicochetTarget on random layouts (closest, not yet hit, range inclusive, later wins a tie)', () => {
    const rand = mulberry32(99);
    const a = arena(cart(3), { seed: 1 });
    for (let k = 0; k < 40; k++) {
      a.fake.enemies.length = 0;
      for (let i = 0; i < 8; i++) a.fake.spawnEnemy({ hp: 10, x: Math.round(rand() * 6) * 20, y: Math.round(rand() * 2) * 20, state: rand() < 0.15 ? 'spawn' : 'walk' });
      const seen = new Set<number>([a.fake.enemies[0].id, a.fake.enemies[1].id]);
      const from = { x: Math.round(rand() * 6) * 20, y: 0 };
      const want = pickRicochetTarget(from, a.fake.enemies.filter((e) => e.alive && e.state !== 'spawn'), seen, 60);
      expect(a.fake.ricochetTarget(from, seen, 60)?.id).toBe(want?.id);
    }
  });
});
