import { describe, expect, it } from 'vitest';
import thunderstorm from '../../../src/content/combos/thunderstorm';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('thunderstorm', thunderstorm, ['Thunderstorm', 'Gewitter']);

describe('Thunderstorm: runtime', () => {
  const setup = () => {
    const { fake, stats } = arena(partsOf(thunderstorm));
    const blast = (hits: unknown[]) => fake.hooks.emit('pattern:cone', { stats: stats as never, x: 0, y: 0, angle: 0, hits: hits as never[] });
    return { fake, stats, blast };
  };
  it('wets every enemy a blast hits for 2 s and strikes nothing on the first two blasts', () => {
    const { fake, blast } = setup();
    const es = [fake.spawnEnemy({ x: 10 }), fake.spawnEnemy({ x: 20 })];
    blast(es); blast(es);
    expect(fake.callsOf('wet').map((w) => [w.enemy, w.seconds])).toEqual([...es, ...es].map((e) => [e.id, 2]));
    expect(fake.callsOf('damage')).toHaveLength(0);
  });
  it('the 3rd blast first strikes the already-Wet enemies (nearest first, max 4, 50% blast damage, quiet) and then wets all hits', () => {
    const { fake, stats, blast } = setup();
    const wet = Array.from({ length: 6 }, (_, i) => fake.spawnEnemy({ x: 60 - i * 10, y: 0, hp: 1000 }));
    wet.forEach((e) => fake.wet(e, 5));
    const dry = fake.spawnEnemy({ x: 1, hp: 1000 });
    fake.clear();
    blast([]); blast([]);
    blast([dry, ...wet]);
    const dmg = fake.callsOf('damage');
    expect(dmg.map((d) => d.enemy)).toEqual([...wet].reverse().slice(0, 4).map((e) => e.id));
    dmg.forEach((d) => { expect(d.dmg).toBe(stats.damage * 0.5); expect(d.source).toBe(stats.uid); expect(d.opts).toEqual({ quiet: true }); });
    expect(fake.callsOf('boltFx')).toHaveLength(4);
    expect(fake.calls.filter((c) => c.kind === 'fx' && c.method === 'arc')).toHaveLength(1);
    const kinds = fake.calls.map((c) => c.kind);
    expect(kinds.lastIndexOf('damage')).toBeLessThan(kinds.indexOf('wet'));
    expect(fake.callsOf('wet')).toHaveLength(7);
  });
  it('strikes again on the 6th blast, and not on the 4th', () => {
    const { fake, blast } = setup();
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.wet(e, 99);
    fake.clear();
    for (let i = 0; i < 6; i++) blast([e]);
    expect(fake.callsOf('damage')).toHaveLength(2);
  });
});
