import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEMS, WEAPON_IDS } from '../src/data/items';
import { pairingSources, weaponPairs } from '../src/engine/weaponPairings';
import { applySlow, newStatus } from '../src/systems/combat';
import { arena, arsenal, at } from './content/helpers';
import { build } from './golden/carts';

afterEach(() => vi.restoreAllMocks());

describe('weapon family interactions', () => {
  it('classifies every weapon; requires placed, edge-adjacent different families', () => {
    expect(WEAPON_IDS).toHaveLength(15);
    expect(WEAPON_IDS.every((id) => !!ITEMS[id].weaponFamily)).toBe(true);
    expect(weaponPairs(build([at('toaster'), at('fizz')]))[0].id).toBe('overkill');
    expect(weaponPairs(build([at('toaster'), at('fizz', 1, { near: [], apart: [0] })]))).toEqual([]);
    expect(weaponPairs(build([at('toaster'), at('nailgun')]))).toEqual([]);
    const inv = build([at('toaster')]);
    inv.shelf[0] = { uid: 'shelf', type: 'fizz', x: 0, y: 0, rot: 0 };
    expect(weaponPairs(inv)).toEqual([]);
  });

  it('Overkill credits the Spreader blast and never chains', () => {
    const { fake, b } = arena([at('toaster'), at('fizz')]);
    const victim = fake.spawnEnemy({ hp: 1, x: 10 });
    const other = fake.spawnEnemy({ hp: 1, x: 30 });
    fake.spawnEnemy({ hp: 100, x: 200 });
    fake.hit(victim, 10, b.weapons[0]);
    const blasts = fake.callsOf('damage').filter((c) => c.opts.label === 'Overkill');
    expect(blasts).toHaveLength(1);
    expect(blasts[0]).toMatchObject({ source: 'u1', enemy: other.id, dmg: b.weapons[1].damage * 0.4, opts: { chained: true, fromPopper: true } });
  });

  it('Exploit consumes a paired mark; expiry, echo and pooled-enemy reset are respected', () => {
    const { fake, b } = arena([at('toaster'), at('tomato')]);
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.hit(e, 0, b.weapons[1]);
    fake.hit(e, 10, b.weapons[0], { echo: true });
    const before = e.hp;
    fake.hit(e, 10, b.weapons[0]); expect(before - e.hp).toBe(15);
    fake.hit(e, 10, b.weapons[0]); expect(before - e.hp).toBe(25);
    fake.hit(e, 0, b.weapons[1]); fake.advance(3.1);
    const expired = e.hp; fake.hit(e, 10, b.weapons[0]); expect(expired - e.hp).toBe(10);
    fake.hit(e, 0, b.weapons[1]); e.status = newStatus();
    const recycled = e.hp; fake.hit(e, 10, b.weapons[0]); expect(recycled - e.hp).toBe(10);
  });

  it('Pinpoint prioritizes Controller targets and conditionally crits during its window', () => {
    const { fake, b } = arena([at('toaster'), at('pan')]);
    const near = fake.spawnEnemy({ hp: 1000, x: 20 }), held = fake.spawnEnemy({ hp: 1000, x: 100 });
    vi.spyOn(fake, 'rng').mockReturnValue(0);
    fake.hit(held, 0, b.weapons[1]);
    const ev = { stats: b.weapons[0], candidates: [near, held], target: near };
    fake.hooks.emit('pattern:target', ev); expect(ev.target).toBe(held);
    fake.hit(held, 10, b.weapons[0]); expect(held.hp).toBe(980);
    fake.advance(1.6); fake.hit(held, 10, b.weapons[0]); expect(held.hp).toBe(970);
  });

  it('Vacuum suction opens control before its damage pulse', () => {
    const { fake, b } = arena([at('toaster'), at('vacuum')]);
    const e = fake.spawnEnemy({ hp: 1000, x: 100 });
    vi.spyOn(fake, 'rng').mockReturnValue(0);
    fake.tick(0.1); fake.hit(e, 10, b.weapons[0]); expect(e.hp).toBe(980);
  });

  it('Vacuum suction refresh never shortens a longer pulse control window', () => {
    const { fake, b } = arena([at('toaster'), at('vacuum')]);
    const e = fake.spawnEnemy({ hp: 1000, x: 100 });
    vi.spyOn(fake, 'rng').mockReturnValue(0);
    fake.hit(e, 0, b.weapons[1]);
    fake.tick(0.1); e.x = 300; fake.advance(0.5);
    fake.hit(e, 10, b.weapons[0]); expect(e.hp).toBe(980);
  });

  it('Contagion transfers half poison/duration once; transferred statuses cannot propagate', () => {
    const { fake, b } = arena([at('fizz'), at('tomato')]);
    const seed = fake.spawnEnemy({ hp: 1000, x: 0 }), next = fake.spawnEnemy({ hp: 1000, x: 50 });
    const far = fake.spawnEnemy({ hp: 1000, x: 200 });
    fake.hit(seed, 0, b.weapons[1]); fake.poison(seed, 8, 6);
    fake.hit(seed, 1, b.weapons[0]);
    expect(next.status.poisonDps).toBe(4); expect(next.status.poisonUntil).toBe(3);
    expect(far.status.poisonUntil).toBe(0);
    next.x = 160; fake.hit(next, 1, b.weapons[0]); expect(far.status.poisonUntil).toBe(0);
  });

  it('Compression needs a Controller window and two nearby enemies', () => {
    const { fake, b } = arena([at('cooker'), at('pan')]);
    const e = fake.spawnEnemy({ hp: 1000, x: 100 });
    fake.hit(e, 0, b.weapons[1]); fake.hit(e, 10, b.weapons[0]); expect(e.hp).toBe(990);
    fake.spawnEnemy({ hp: 1000, x: 140 }); fake.spawnEnemy({ hp: 1000, x: 150 });
    fake.hit(e, 10, b.weapons[0]); expect(e.hp).toBe(976.5);
  });

  it('Hazard extends poison/Wet and strengthens slow on controlled targets', () => {
    const { fake, b } = arena([at('mop'), at('pan')]);
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.hit(e, 0, b.weapons[1]);
    fake.poison(e, 5, 3); fake.wet(e, 3); applySlow(e.status, { pct: 0.25, duration: 1 }, fake.now());
    fake.hit(e, 0, b.weapons[0]);
    expect(e.status.poisonUntil).toBe(4); expect(e.status.wetUntil).toBe(4);
    expect(e.status.slowPct).toBeCloseTo(0.35);
  });

  it('duplicates compile one pairing; moving weapons apart removes it', () => {
    expect(pairingSources(build([at('toaster'), at('fizz'), at('fizz')], 8, 6))).toHaveLength(1);
    const { fake, b } = arena([at('toaster'), at('fizz', 1, { near: [], apart: [0] })]);
    const victim = fake.spawnEnemy({ hp: 1 }); fake.spawnEnemy({ hp: 100, x: 50 });
    fake.hit(victim, 10, b.weapons[0]);
    expect(fake.callsOf('damage').filter((c) => c.opts.label === 'Overkill')).toEqual([]);
  });
});

describe('weapon identities', () => {
  it('Toaster executes wounded enemies and targets them ahead of healthy enemies', () => {
    const { fake, a, stats } = arsenal([at('toaster')]);
    fake.spawnEnemy({ hp: 100, x: 100, y: 100 });
    const wounded = fake.spawnEnemy({ hp: 40, maxHp: 100, x: 200 });
    fake.hit(wounded, 10, stats); expect(wounded.hp).toBe(25);
    a.step(0.41); expect(a.spawned[0].angle).toBe(0);
  });

  it('Nail Gun focus caps at +40% and resets on timeout or a new target', () => {
    const { fake, stats } = arena([at('nailgun')]);
    const e = fake.spawnEnemy({ hp: 1000 }), deltas: number[] = [];
    for (let i = 0; i < 8; i++) { const before = e.hp; fake.hit(e, 10, stats); deltas.push(before - e.hp); }
    expect(deltas[0]).toBe(10); expect(deltas[1]).toBeCloseTo(10.8); expect(deltas[7]).toBe(14);
    fake.advance(1.6); const before = e.hp; fake.hit(e, 10, stats); expect(before - e.hp).toBe(10);
    const other = fake.spawnEnemy({ hp: 100 }); fake.hit(other, 10, stats); expect(other.hp).toBe(90);
  });

  it('Microwave ramps on the same target and resets on another', () => {
    const { fake, a } = arsenal([at('microwave')]);
    const tank = fake.spawnEnemy({ hp: 10000, x: 100 }), deltas: number[] = [];
    for (let i = 0; i < 5; i++) { a.weapons[0].cd = 0; const before = tank.hp; a.step(0.01); deltas.push(before - tank.hp); }
    expect(deltas).toEqual([24, 30, 36, 42, 42]);
    const other = fake.spawnEnemy({ hp: 20000, x: 300 });
    a.weapons[0].cd = 0; a.step(0.01); expect(other.hp).toBe(19976);
  });
});
