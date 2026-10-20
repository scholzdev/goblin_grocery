import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import popcorn from '../../../src/content/items/popcorn';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { PATTERNS } from '../../../src/engine/patterns';
import { arsenal, at } from '../helpers';

// Popcorn Maker: six kernels per volley, each at a random enemy in range (engine/patterns/popcorn.ts), one rng draw per kernel.
const volley = (enemies: { x: number; y: number }[], seed = 3) => {
  const r = arsenal([at('popcorn')], { seed });
  const es = enemies.map((p) => r.fake.spawnEnemy({ ...p, hp: 1000 }));
  r.a.step(0.5); // the first cooldown (0.4 s) runs out
  return { ...r, es };
};

afterEach(() => setLang('en'));

describe('Popcorn Maker: content', () => {
  it('is the registered content file: a 1x2 Snacks/Blast weapon with the popcorn pattern', () => {
    expect(contentItem('popcorn')).toBe(popcorn);
    expect(ITEMS.popcorn).toMatchObject({ id: 'popcorn', family: 'snacks', element: 'blast', kind: 'weapon', price: 13, electrical: false });
    expect(ITEMS.popcorn.weapon).toMatchObject({ pattern: 'popcorn', damage: 3, cooldown: 1.3, range: 240, projectileSpeed: 520, count: 6 });
    expect(itemT('popcorn')).toMatchObject({ name: 'Popcorn Maker', blurb: 'Pop. Pop. Pop-pop-pop.' });
  });

  it('renders its text for every level, the re-pop from ★3 on, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('popcorn', t))).toEqual([
      'Pops 6 kernels every 1.3 s, each at a random enemy in range. 3 damage per kernel. 240 range.',
      'Pops 6 kernels every 1.17 s, each at a random enemy in range. 4.5 damage per kernel. 240 range.',
      'Pops 6 kernels every 1.04 s, each at a random enemy in range. 6 damage per kernel. 240 range. ★3: A kernel that lands without a hit pops once more at the nearest enemy for 50% of its damage.',
    ]);
    setLang('de');
    expect(itemRules('popcorn', 3)).toBe('Schießt alle 1,04 s 6 Körner, jedes auf einen zufälligen Gegner in Reichweite. 6 Schaden pro Korn. 240 Reichweite. ★3: Ein Korn, das ohne Treffer landet, springt noch einmal auf den nächsten Gegner, mit 50% seines Schadens.');
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

describe('Popcorn Maker: ★3 re-pop', () => {
  // V is the only enemy in range, so all six kernels fly at it; the first one knocks it out and the other five fly on and land around (358, 400).
  // T is out of range of the goblin but within 240 of that landing spot. U is only within reach of where the re-pops would land.
  const P = { player: { x: 100, y: 400 } };
  const afterVolley = (tier: number, tHp = 1000) => {
    const r = arsenal([at('popcorn', tier)], P);
    const v = r.fake.spawnEnemy({ x: 250, y: 400, hp: 1 });
    const t = r.fake.spawnEnemy({ x: 450, y: 500, hp: tHp });
    const u = r.fake.spawnEnemy({ x: 600, y: 650, hp: 1000 });
    while (!r.a.spawned.length) r.a.step(0.02);
    r.a.weapons[0].cd = 99;
    r.a.run(60, 0.02);
    return { ...r, v, t, u, repops: r.a.spawned.slice(6) };
  };

  it('★2 kernels that miss are gone; from ★3 each that lands pops once more at the nearest enemy for half its damage', () => {
    expect(afterVolley(2).repops).toHaveLength(0);
    for (const [tier, damage] of [[3, 6], [4, 7.5]]) {
      const { repops, fake, t } = afterVolley(tier);
      expect(repops, `★${tier}`).toHaveLength(5);
      expect(repops.every((s) => s.key === 'proj_kernel' && s.damage === damage / 2 && s.x > 340 && s.angle === repops[0].angle), `★${tier}`).toBe(true);
      expect(fake.callsOf('damage').filter((c) => c.enemy === t.id).map((c) => c.dmg), `★${tier}`).toEqual([damage / 2, damage / 2, damage / 2, damage / 2, damage / 2]);
    }
    // Near the top edge (shots die above y 120) the kernels that miss leave the floor before their flight ends: that is not landing.
    const edge = arsenal([at('popcorn', 3)], { player: { x: 100, y: 200 } });
    edge.fake.spawnEnemy({ x: 130, y: 130, hp: 1 });
    const far = edge.fake.spawnEnemy({ x: 330, y: 120, hp: 1000 }); // out of the goblin's range, within 240 of where the kernels leave
    while (!edge.a.spawned.length) edge.a.step(0.02);
    edge.a.weapons[0].cd = 99;
    edge.a.run(60, 0.02);
    expect(edge.a.spawned).toHaveLength(6);
    expect(edge.fake.callsOf('damage').some((c) => c.enemy === far.id)).toBe(false);
  });

  it('a kernel that hits does not pop again, and a re-popped kernel never pops a second time', () => {
    const { repops, fake, u } = afterVolley(3, 1);
    expect(repops).toHaveLength(5); // the five that missed V; the one that hit stays spent
    expect(fake.callsOf('damage').some((c) => c.enemy === u.id)).toBe(false); // four re-pops miss the dead T and land near U, without popping on
  });
});
