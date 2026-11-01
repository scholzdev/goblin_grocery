import { afterEach, describe, expect, it } from 'vitest';
import { arena, arsenal, at } from '../helpers';
import { itemRules } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { tickPoison } from '../../../src/systems/combat';

afterEach(() => setLang('en'));

describe('Rotten Tomato', () => {
  it('fires a real projectile that poisons its target, then poison keeps ticking after it leaves range', () => {
    const { a, fake } = arsenal([at('tomato')], { player: { x: 100, y: 400 } });
    const e = fake.spawnEnemy({ x: 250, y: 400, hp: 100 });
    a.run(35, 0.02);
    expect(a.spawned[0].key).toBe('proj_tomato');
    expect(e.hp).toBe(98);
    expect(e.status.poisonDps).toBe(5);
    e.x = 1000;
    fake.advance(4);
    const damage = tickPoison(e.status, fake.now());
    expect(damage).toBe(20);
    fake.hit(e, damage, null, { isDot: true, poison: true });
    expect(e.hp).toBe(78);
  });

  it('prefers an unpoisoned enemy, then falls back when every target is poisoned', () => {
    const { a, fake } = arsenal([at('tomato')], { player: { x: 100, y: 400 } });
    const near = fake.spawnEnemy({ x: 200, y: 400, hp: 1000 });
    const fresh = fake.spawnEnemy({ x: 100, y: 650, hp: 1000 });
    fake.poison(near, 4, 4);
    a.step(0.4);
    expect(a.spawned[0].angle).toBeCloseTo(Math.atan2(250, -18));
    fake.poison(fresh, 4, 4);
    a.weapons[0].cd = 0;
    a.step(0.01);
    expect(a.spawned[1].angle).toBe(0);
  });

  it('uses each firing instance tier and refreshes poison without stacking', () => {
    const { fake, b } = arena([at('tomato', 1), at('tomato', 3)]);
    const lowDps = 5.3, highDps = 15.9;
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.hit(e, 2, b.weapons[0]);
    expect(e.status.poisonDps).toBeCloseTo(lowDps);
    fake.advance(1);
    fake.hit(e, 4, b.weapons[1]);
    expect(e.status.poisonDps).toBeCloseTo(highDps);
    fake.advance(1);
    fake.hit(e, 2, b.weapons[0]);
    expect(e.status.poisonDps).toBeCloseTo(highDps);
    expect(e.status.poisonUntil).toBe(8);
  });

  it('★3 spreads only the remaining poison on a DoT kill, without a second generation', () => {
    const { fake, stats } = arena([at('tomato', 3)]);
    const original = fake.spawnEnemy({ x: 100, hp: 100 });
    const next = fake.spawnEnemy({ x: 150, hp: 100 });
    const outside = fake.spawnEnemy({ x: 250, hp: 100 });
    fake.hit(original, 4, stats);
    fake.advance(1.5);
    fake.hit(original, 1000, null, { isDot: true, poison: true });
    expect(next.status.poisonDps).toBe(15);
    expect(next.status.poisonUntil).toBe(6);
    expect(outside.status.poisonDps).toBe(0);
    outside.x = 180;
    fake.hit(next, 1000, null, { isDot: true, poison: true });
    expect(outside.status.poisonDps).toBe(0);
  });

  it('does not spread at ★1/★2, after expiry, or from unrelated poison', () => {
    for (const tier of [1, 2, 3]) {
      const { fake, stats } = arena([at('tomato', tier)]);
      const e = fake.spawnEnemy({ hp: 1000 });
      const next = fake.spawnEnemy({ x: 30, hp: 1000 });
      fake.hit(e, 2, stats);
      if (tier === 3) fake.advance(7);
      fake.hit(e, 10000, null);
      expect(next.status.poisonDps).toBe(0);
    }
    const { fake } = arena([at('tomato', 3)]);
    const e = fake.spawnEnemy();
    const next = fake.spawnEnemy({ x: 30 });
    fake.poison(e, 10, 4);
    fake.hit(e, 1000, null);
    expect(next.status.poisonDps).toBe(0);
  });

  it('supports extra projectiles and piercing from adjacent modules', () => {
    const { a, fake, stats } = arsenal([at('tomato'), at('multipack'), at('tape')], { player: { x: 100, y: 400 } });
    fake.spawnEnemy({ x: 350, y: 400 });
    a.step(0.4);
    expect(stats.count).toBe(2);
    expect(a.spawned).toHaveLength(2);
    expect(a.spawned[0].maxHits).toBe(2);
  });

  it('shows poison scaling and localized rules, including the ★3 spread', () => {
    expect(tierScaling('tomato').at(-1)).toEqual({ label: 'Poison', values: ['5/s', '10/s', '15/s'] });
    expect(itemRules('tomato', 1)).toContain('5/s');
    expect(itemRules('tomato', 1)).not.toContain('★3');
    expect(itemRules('tomato', 3)).toContain('Spread poison cannot spread again');
    setLang('de');
    expect(itemRules('tomato', 3)).toContain('Tomatengift');
  });
});
