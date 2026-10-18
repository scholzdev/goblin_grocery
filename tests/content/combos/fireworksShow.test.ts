import { expect, it } from 'vitest';
import fireworksShow from '../../../src/content/combos/fireworksShow';
import { combatRng } from '../../../src/systems/rng';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('fireworksShow', fireworksShow, ['Fireworks Show', 'Feuerwerk']);

it('Fireworks Show: a blast sets off 6 blasts evenly on a ring of 110 (one rng draw for the start angle): 40% damage, radius 45', () => {
  const { fake, stats, b } = arena(partsOf(fireworksShow), { seed: 15 });
  fake.hooks.emit('pattern:explode', { stats, x: 40, y: 50, hits: [] });
  const blasts = fake.callsOf('popperBlast'), start = combatRng(15, 0)() * Math.PI * 2, mult = b.sets.blast ? 1.15 : 1;
  expect(blasts).toHaveLength(6);
  blasts.forEach((b, i) => {
    const a = start + (i / 6) * Math.PI * 2;
    expect(b).toMatchObject({ damage: stats.damage * 0.4, radius: 45 * mult });
    expect(b.x).toBeCloseTo(40 + Math.cos(a) * 110, 9);
    expect(b.y).toBeCloseTo(50 + Math.sin(a) * 110, 9);
  });
  const ref = combatRng(15, 0);
  ref();
  expect(fake.rng()).toBe(ref());
});

it('a cooker without Sparklers sets off nothing and draws nothing', () => {
  const { fake, stats } = arena([at('cooker')], { seed: 15 });
  fake.hooks.emit('pattern:explode', { stats, x: 0, y: 0, hits: [] });
  expect(fake.callsOf('popperBlast')).toHaveLength(0);
  expect(fake.rng()).toBe(combatRng(15, 0)());
});
