import { describe, expect, it } from 'vitest';
import { Tag } from '../../../src/engine/ids';
import { arena, at, far } from '../helpers';

const pepper = (tier = 1, hp = 40) => arena([at('toaster'), far('ghostpepper', tier)], { hp, maxHp: 40 });

describe('Ghost Pepper: damage', () => {
  it('adds +50% / +65% / +80% to heat hits and burn ticks, nothing else', () => {
    [1.5, 1.65, 1.8].forEach((m, i) => {
      const { fake } = pepper(i + 1);
      const burn = fake.spawnEnemy({ hp: 1000 }), plain = fake.spawnEnemy({ hp: 1000 });
      fake.hit(burn, 10, null, { isDot: true });
      expect(1000 - burn.hp).toBeCloseTo(10 * m, 9);
      fake.hit(plain, 10, null, { label: 'dash' });
      expect(1000 - plain.hp).toBe(10);
    });
    expect(Tag.heat).toBe('heat');
  });
});

describe('Ghost Pepper: burn', () => {
  it('a hit sets you on fire: 1.5 dps for 2 s is 3 HP, in four 0.75 ticks', () => {
    const { fake } = pepper();
    fake.hurt(5);
    expect(fake.run.hp).toBe(35);
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) { fake.tick(0.05); seen.push(fake.run.hp); }
    expect(fake.run.hp).toBeCloseTo(32, 9);
    expect(fake.callsOf('drain').map((c) => c.hp)).toEqual([0.75, 0.75, 0.75, 0.75]);
    fake.tick(1); // burnt out: nothing more
    expect(fake.run.hp).toBeCloseTo(32, 9);
  });

  it('refreshes instead of stacking: a second hit while burning keeps one burn', () => {
    const { fake } = pepper();
    fake.hurt(5);
    for (let i = 0; i < 20; i++) fake.tick(0.05); // 1 s in
    fake.player.invulnT = 0;
    fake.hurt(5);
    for (let i = 0; i < 100; i++) fake.tick(0.05);
    const burn = fake.callsOf('drain').length;
    expect(burn).toBe(6); // 1 s + a fresh 2 s = 3 s = 6 ticks, not 8
  });

  it('never kills: the burn stops at 1 HP', () => {
    const { fake } = pepper(1, 3);
    fake.hurt(1); // 2 HP left, 3 HP of burn coming
    for (let i = 0; i < 100; i++) fake.tick(0.05);
    expect(fake.run.hp).toBe(1);
    expect(fake.player.dead).toBe(false);
  });

  it('a burn does not grant i-frames or run the hit hooks', () => {
    const { fake } = pepper();
    fake.hurt(5);
    fake.player.invulnT = 0;
    const hurts = fake.callsOf('hurt').length;
    for (let i = 0; i < 40; i++) fake.tick(0.05);
    expect(fake.player.invulnT).toBe(0);
    expect(fake.callsOf('hurt').length).toBe(hurts);
  });

  it('shows BURNING while it lasts and clears it after', () => {
    const { fake } = pepper();
    fake.hurt(5);
    expect(fake.callsOf('line').at(-1)).toMatchObject({ id: 'ghostpepper', text: 'BURNING' });
    for (let i = 0; i < 45; i++) fake.tick(0.05);
    expect(fake.callsOf('line').at(-1)).toMatchObject({ id: 'ghostpepper', text: null });
  });

  it('is off without the item', () => {
    const { fake } = arena([at('toaster')], { hp: 40, maxHp: 40 });
    fake.hurt(5);
    for (let i = 0; i < 60; i++) fake.tick(0.05);
    expect(fake.run.hp).toBe(35);
  });
});
