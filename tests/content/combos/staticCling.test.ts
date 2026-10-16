import { describe, expect, it } from 'vitest';
import staticCling from '../../../src/content/combos/staticCling';
import { combatRng } from '../../../src/systems/rng';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('staticCling', staticCling, ['Static Cling', 'Statische Aufladung']);

describe('Static Cling: runtime', () => {
  const pulse = (stats: never, inside: never[]) => ({ stats, x: 0, y: 0, inside });
  it('each pulse zaps 3 random enemies inside it for 150% weapon damage (shuffle with the combat rng, exact order and draw count)', () => {
    const { fake, stats: built } = arena(partsOf(staticCling), { seed: 21 });
    const stats = { ...built, critChance: 0 }; // so the damage itself draws nothing
    const es = Array.from({ length: 6 }, (_, i) => fake.spawnEnemy({ x: i, y: i, hp: 1000 }));
    const ref = combatRng(21, 0);
    let sortDraws = 0;
    const want = [...es].sort(() => { sortDraws++; return ref() - 0.5; }).slice(0, 3);
    // The Electric set (battery + vacuum) rolls its own chain on each hit: count only the draws before the first damage, the shuffle's own.
    let drawn = 0, atFirstDamage = -1;
    const rng = fake.rng.bind(fake), damage = fake.damage.bind(fake);
    fake.rng = () => { drawn++; return rng(); };
    fake.damage = (...a: Parameters<typeof damage>) => { if (atFirstDamage < 0) atFirstDamage = drawn; damage(...a); };
    fake.hooks.emit('pattern:pulse', pulse(stats as never, es as never[]));
    const dmg = fake.callsOf('damage');
    expect(dmg.map((d) => d.enemy)).toEqual(want.map((e) => e.id));
    dmg.forEach((d) => { expect(d.dmg).toBe(stats.damage * 1.5); expect(d.source).toBe(stats.uid); });
    expect(fake.callsOf('boltFx')).toHaveLength(3);
    expect(fake.callsOf('boltFx').map((b) => [b.x, b.small])).toEqual(want.map((e) => [e.x, true]));
    expect(atFirstDamage).toBe(sortDraws);
  });
  it('fewer than 3 inside: all of them; none inside: no sound, no damage', () => {
    const { fake, stats } = arena(partsOf(staticCling), { seed: 21 });
    const two = [fake.spawnEnemy({ hp: 1000 }), fake.spawnEnemy({ hp: 1000 })];
    fake.hooks.emit('pattern:pulse', pulse(stats as never, two as never[]));
    expect(fake.callsOf('damage')).toHaveLength(2);
    fake.clear();
    fake.hooks.emit('pattern:pulse', pulse(stats as never, []));
    expect(fake.calls).toHaveLength(0);
  });
  it('does not shuffle the caller\'s list, and a vacuum without the combo does nothing', () => {
    const { fake, stats } = arena(partsOf(staticCling));
    const es = Array.from({ length: 5 }, () => fake.spawnEnemy({ hp: 1000 })), ids = es.map((e) => e.id);
    fake.hooks.emit('pattern:pulse', pulse(stats as never, es as never[]));
    expect(es.map((e) => e.id)).toEqual(ids);
    const plain = arena([at('vacuum')]);
    plain.fake.hooks.emit('pattern:pulse', pulse(plain.stats as never, es as never[]));
    expect(plain.fake.calls).toHaveLength(0);
  });
});
