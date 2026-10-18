import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import popcorn from '../../../src/content/items/popcorn';
import { contentItem } from '../../../src/engine/registry';
import { itemT } from '../../../src/i18n/data';
import { PATTERNS } from '../../../src/engine/patterns';
import { arsenal, at } from '../helpers';

// Popcorn Maker: six kernels per volley, each at a random enemy in range (engine/patterns/popcorn.ts), one rng draw per kernel.
const volley = (enemies: { x: number; y: number }[], seed = 3) => {
  const r = arsenal([at('popcorn')], { seed });
  const es = enemies.map((p) => r.fake.spawnEnemy({ ...p, hp: 1000 }));
  r.a.step(0.5); // the first cooldown (0.4 s) runs out
  return { ...r, es };
};

describe('Popcorn Maker: content', () => {
  it('is the registered content file: a 1x2 Snacks/Blast weapon with the popcorn pattern', () => {
    expect(contentItem('popcorn')).toBe(popcorn);
    expect(ITEMS.popcorn).toMatchObject({ id: 'popcorn', family: 'snacks', element: 'blast', kind: 'weapon', price: 13, electrical: false });
    expect(ITEMS.popcorn.weapon).toMatchObject({ pattern: 'popcorn', damage: 3, cooldown: 1.3, range: 240, projectileSpeed: 520, count: 6 });
    expect(itemT('popcorn')).toMatchObject({ name: 'Popcorn Maker', blurb: 'Pop. Pop. Pop-pop-pop.' });
  });
});

describe('Popcorn Maker: runtime', () => {
  it('fires 6 kernels of 3 damage per volley', () => {
    const { a } = volley([{ x: 100, y: 0 }]);
    expect(a.spawned).toHaveLength(6);
    expect(a.spawned.every((s) => s.key === 'proj_kernel' && s.damage === 3 && s.speed === 520)).toBe(true);
  });

  it('aims each kernel at an enemy in range, not only the nearest, and never at one out of range', () => {
    const { a } = volley([{ x: 100, y: 0 }, { x: 0, y: 200 }, { x: 600, y: 0 }]);
    const toward = [[100, 0], [0, 200]].map(([x, y]) => Math.atan2(y, x - 18)); // the muzzle is 18 px ahead of the goblin
    const angles = new Set(a.spawned.map((s) => s.angle));
    expect([...angles].every((x) => toward.some((t) => Math.abs(t - x) < 1e-9))).toBe(true);
    expect(angles.size).toBe(2); // seed 3 sends kernels at both
  });

  it('fires at random angles when called with nobody in range (one draw per kernel); the arsenal itself waits for an enemy', () => {
    const r = arsenal([at('popcorn')], { seed: 3 });
    r.a.step(0.5);
    expect(r.a.spawned).toHaveLength(0);
    PATTERNS.popcorn.fire(r.a, r.a.weapons[0], null);
    const angles = r.a.spawned.map((s) => s.angle);
    expect(angles).toHaveLength(6);
    expect(new Set(angles).size).toBe(6);
    expect(angles.every((x) => x >= 0 && x < Math.PI * 2)).toBe(true);
  });

  it('draws exactly one rng value per kernel', () => {
    const { a, fake } = volley([{ x: 100, y: 0 }]), after = fake.rng();
    const ref = arsenal([at('popcorn')], { seed: 3 }).fake;
    for (let i = 0; i < 6; i++) ref.rng();
    expect(after).toBe(ref.rng());
    expect(a.spawned).toHaveLength(6);
  });
});
