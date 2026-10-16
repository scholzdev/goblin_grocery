import { describe, expect, it } from 'vitest';
import { combatRng } from '../../src/systems/rng';
import { arena, at } from '../content/helpers';

// The stats-driven on-kill behavior (src/engine/onKillEffects.ts): the Party Popper blast. `WeaponStats.popper` is set by the Party Popper
// item, by Jelly Beans (blast) and sized by the Blast set; the engine fires it, whoever set it.

describe('popper blast (WeaponStats.popper)', () => {
  const popper = () => arena([at('nailgun'), at('popper')]);

  it('a kill by a popper weapon explodes in confetti at the dead enemy: the item\'s damage and radius', () => {
    const { fake, stats } = popper();
    const victim = fake.spawnEnemy({ hp: 5, x: 100, y: 40 }), bystander = fake.spawnEnemy({ hp: 50, x: 150, y: 40 });
    fake.hit(victim, 10, stats);
    expect(fake.callsOf('popperBlast')).toEqual([{ at: 0, kind: 'popperBlast', x: 100, y: 40, damage: 6, radius: 80.5, setPop: false }]);
    expect(bystander.hp).toBe(44);
  });

  it('only lethal hits explode', () => {
    const { fake, stats } = popper();
    fake.hit(fake.spawnEnemy({ hp: 50 }), 10, stats);
    expect(fake.callsOf('popperBlast')).toEqual([]);
  });

  it('popper blasts never chain: kills by the blast itself do not blast again', () => {
    const { fake, stats } = popper();
    const a = fake.spawnEnemy({ hp: 5, x: 0, y: 0 }), b = fake.spawnEnemy({ hp: 3, x: 40, y: 0 }), c = fake.spawnEnemy({ hp: 3, x: 80, y: 0 });
    fake.hit(a, 10, stats);
    expect(b.alive).toBe(false); // the blast killed the neighbors ...
    expect(c.alive).toBe(false);
    expect(fake.callsOf('popperBlast')).toHaveLength(1); // ... and nothing exploded again
  });

  it('a lethal hit that is itself marked fromPopper does not blast even with a popper weapon', () => {
    const { fake, stats } = popper();
    fake.hit(fake.spawnEnemy({ hp: 1 }), 5, stats, { fromPopper: true });
    expect(fake.callsOf('popperBlast')).toEqual([]);
  });

  it('is not tied to the Party Popper item: a Jelly Beans (blast) popper blasts with its own numbers', () => {
    const { fake, stats } = arena([at('nailgun'), at('jellybeans', 1, { flavor: 'blast' })]);
    expect(stats.buffs).not.toContain('popper');
    fake.hit(fake.spawnEnemy({ hp: 1 }), 5, stats);
    expect(fake.callsOf('popperBlast')[0]).toMatchObject({ damage: stats.popper!.damage, radius: stats.popper!.radius });
    expect(stats.popper!.damage).toBeCloseTo(4.2, 12);
  });

  it('weapons without a popper, and hits without a weapon (dash, hazards), never blast', () => {
    const plain = arena([at('nailgun')]);
    plain.fake.hit(plain.fake.spawnEnemy({ hp: 1 }), 5, plain.stats);
    plain.fake.hit(plain.fake.spawnEnemy({ hp: 1 }), 5, null, { label: 'shove' });
    expect(plain.fake.callsOf('popperBlast')).toEqual([]);
  });

  it('draws no random numbers', () => {
    const { fake, stats } = arena([at('nailgun'), at('popper')], { seed: 9 });
    fake.hit(fake.spawnEnemy({ hp: 1 }), 5, stats);
    expect(fake.rng()).toBe(combatRng(9, 0)());
  });
});
