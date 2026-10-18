import { expect, it } from 'vitest';
import kettleCorn from '../../../src/content/combos/kettleCorn';
import { combatRng } from '../../../src/systems/rng';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('kettleCorn', kettleCorn, ['Kettle Corn', 'Karamell-Popcorn']);

const kill = (fake: ReturnType<typeof arena>['fake'], stats: ReturnType<typeof arena>['stats'], x = 30, y = 40) => {
  const e = fake.spawnEnemy({ x, y, hp: 1 });
  fake.hit(e, 5, stats);
};

it('Kettle Corn: a kernel kill scatters 3 kernels from the corpse at random angles (2.5 damage, range 160 at speed 520, 1 hit, no popper)', () => {
  const { fake, stats } = arena(partsOf(kettleCorn), { seed: 15 });
  kill(fake, stats);
  const shots = fake.callsOf('spawnShot').map((s) => s.spec), ref = combatRng(15, 0);
  expect(shots).toHaveLength(3);
  for (const s of shots) {
    expect(s).toMatchObject({ key: 'proj_kernel', x: 30, y: 40, speed: 520, life: 160 / 520, damage: 2.5, maxHits: 1 });
    expect(s.angle).toBe(ref() * Math.PI * 2);
    expect(s.stats).toMatchObject({ uid: stats.uid, popper: null });
  }
  expect(fake.callsOf('popperBlast')).toHaveLength(1); // the original kill's confetti
});

it('the scattered kernels\' kills scatter nothing and set off no Party Popper blast', () => {
  const { fake, stats } = arena(partsOf(kettleCorn), { seed: 15 });
  kill(fake, stats);
  const kernel = fake.callsOf('spawnShot')[0].spec.stats;
  fake.clear();
  kill(fake, kernel, 80, 80);
  expect(fake.callsOf('spawnShot')).toHaveLength(0);
  expect(fake.callsOf('popperBlast')).toHaveLength(0);
});

it('popper blast kills and a popcorn maker without the combo scatter nothing', () => {
  const { fake, stats } = arena([at('popcorn')], { seed: 15 });
  kill(fake, stats);
  expect(fake.callsOf('spawnShot')).toHaveLength(0);
  const c = arena(partsOf(kettleCorn), { seed: 15 });
  c.fake.hit(c.fake.spawnEnemy({ hp: 1 }), 5, c.stats, { fromPopper: true });
  expect(c.fake.callsOf('spawnShot')).toHaveLength(0);
});
