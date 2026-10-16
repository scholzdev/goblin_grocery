import { describe, expect, it } from 'vitest';
import bagIt from '../../../src/content/combos/bagIt';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('bagIt', bagIt, ['Bag It', 'Eingetütet']);

type A = ReturnType<typeof arena>;
const kill = (a: A, stats = a.stats) => a.fake.hit(a.fake.spawnEnemy({ hp: 1 }), 5, { ...stats, critChance: 0 });
const dash = (a: A) => a.fake.hooks.emit('onDashStart', { x: 0, y: 0, dx: 1, dy: 0, reach: 100, chained: false });

describe('Bag It: runtime', () => {
  it('each kill by the vacuum adds a charge (shown as "BAG xN", max 10)', () => {
    const a = arena(partsOf(bagIt));
    for (let i = 1; i <= 12; i++) kill(a);
    const lines = a.fake.callsOf('line').map((l) => l.text);
    expect(lines.slice(0, 3)).toEqual(['BAG x1', 'BAG x2', 'BAG x3']);
    expect(lines.at(-1)).toBe('BAG x10');
    expect(a.fake.callsOf('line')[0]).toMatchObject({ id: 'bagIt', order: 1 });
  });
  it('kills by other weapons or the shove do not count', () => {
    const a = arena([...partsOf(bagIt), { ...at('toaster'), near: [], apart: [0] }]);
    kill(a, a.b.weapons[1]);
    a.fake.hit(a.fake.spawnEnemy({ hp: 1 }), 5, null);
    expect(a.fake.callsOf('line')).toHaveLength(0);
  });
  it('dashing without charges does nothing', () => {
    const a = arena(partsOf(bagIt));
    dash(a);
    expect(a.fake.calls).toHaveLength(0);
  });
  it('dashing with charges drops the bag at the goblin, clears the line, and blasts after the 0.4 s fuse: 6 per charge in 120 px, labelled Bag It', () => {
    const a = arena(partsOf(bagIt));
    for (let i = 0; i < 3; i++) kill(a);
    const inside = a.fake.spawnEnemy({ x: 100, y: 0, hp: 1000 }), outside = a.fake.spawnEnemy({ x: 300, y: 0, hp: 1000 });
    a.fake.clear();
    a.fake.player.x = 10; a.fake.player.y = 20;
    inside.x = 110; inside.y = 20; outside.x = 400; outside.y = 20;
    dash(a);
    expect(a.fake.callsOf('fx').find((f) => f.method === 'garbageBag')!.args).toEqual([10, 20, 0.4]);
    expect(a.fake.lines.get('bagIt')).toBeNull();
    a.fake.advance(0.39);
    expect(a.fake.callsOf('damage')).toHaveLength(0);
    a.fake.advance(0.02);
    const dmg = a.fake.callsOf('damage');
    expect(dmg).toHaveLength(1);
    expect(dmg[0]).toMatchObject({ enemy: inside.id, dmg: 18, source: null });
    expect(dmg[0].opts).toMatchObject({ kb: 220, kbX: 1, kbY: 0, label: 'Bag It' });
    expect(outside.hp).toBe(1000);
    expect(a.fake.callsOf('sound').map((s) => s.name)).toContain('boom');
  });
  it('the charges reset on the dash (a second dash drops nothing) and a blast after the aisle ended does nothing', () => {
    const a = arena(partsOf(bagIt));
    kill(a); dash(a);
    a.fake.active = false;
    const e = a.fake.spawnEnemy({ hp: 1000 });
    a.fake.advance(1);
    expect(e.hp).toBe(1000);
    a.fake.active = true; a.fake.clear();
    dash(a);
    expect(a.fake.calls).toHaveLength(0);
  });
  it('draws no random numbers of its own', () => {
    const a = arena(partsOf(bagIt), { seed: 2 });
    a.fake.hooks.emit('onKill', { enemy: a.fake.spawnEnemy(), hit: { stats: a.stats } as never });
    dash(a);
    a.fake.advance(1);
    expect(a.fake.rng()).toBe(arena(partsOf(bagIt), { seed: 2 }).fake.rng());
  });
});
