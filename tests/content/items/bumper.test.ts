import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import bumper from '../../../src/content/items/bumper';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: the dash landing deals 8 damage (x TIER.mult) within 90 of the goblin, with knockback 200 away from the landing point.
describe('Slam Bumper: build field', () => {
  it('sets dashSlam to 8 / 12 / 16 at ★1 / ★2 / ★3, 0 without the item', () => {
    expect(full([at('toaster')]).dashSlam).toBe(0);
    expect([1, 2, 3].map((t) => full([at('toaster'), far('bumper', t)]).dashSlam)).toEqual([8, 12, 16]);
  });

  it('matches the legacy formula 8 x TIER.mult to the bit, also at Gold Star\'s effective ★4 (20)', () => {
    for (const t of [1, 2, 3]) expect(full([at('toaster'), far('bumper', t)]).dashSlam).toBe(8 * TIER.mult(t));
    expect(full([at('toaster'), corner('bumper', 3), gilded(1)]).dashSlam).toBe(20);
  });

  it('does not stack: the best copy counts once', () => {
    expect(full([at('toaster'), far('bumper', 1), far('bumper', 3)]).dashSlam).toBe(16);
  });
});

// The landing blast is an `onDashEnd` hook. Legacy order inside dashLanding: sound, ring, one damageEnemy per enemy in range, then Pot Slam.
describe('Slam Bumper: runtime', () => {
  const landing = { x: 300, y: 400, dx: 1, dy: 0, hit: false };
  const land = (tier = 1, enemies: { x: number; y: number; radius?: number; hp?: number }[] = []) => {
    const { fake } = arena([at('toaster'), far('bumper', tier)]);
    const list = enemies.map((e) => fake.spawnEnemy({ x: e.x, y: e.y, hp: e.hp ?? 100, def: { radius: e.radius ?? 20 } }));
    fake.hooks.emit('onDashEnd', landing);
    return { fake, list };
  };

  it('plays the boom, draws the ring at the landing point, then damages each enemy in range with the Slam Bumper label and no weapon', () => {
    const { fake, list } = land(1, [{ x: 350, y: 400 }]);
    expect(fake.callsOf('sound')).toEqual([{ at: 0, kind: 'sound', name: 'boom', opts: { volume: 0.5 } }]);
    expect(fake.callsOf('fx')).toEqual([{ at: 0, kind: 'fx', method: 'ring', args: ['fx_boom', 300, 400, 180, 300, 0xf5bd45] }]);
    expect(fake.callsOf('damage')).toEqual([{ at: 0, kind: 'damage', enemy: list[0].id, dmg: 8, source: null, opts: { kb: 200, kbX: 1, kbY: 0, label: 'Slam Bumper' } }]);
    expect(list[0].hp).toBe(92);
    // the sound comes first, then the ring, then the damage (the legacy order)
    expect(fake.calls.map((c) => c.kind)).toEqual(['sound', 'fx', 'damage']);
  });

  it('knocks each enemy away from the landing point (unit vector), and an enemy exactly on it gets (0, 0)', () => {
    const { fake, list } = land(1, [{ x: 300, y: 340 }, { x: 330, y: 440 }, { x: 300, y: 400 }]);
    const [up, diag, onTop] = fake.callsOf('damage').map((c) => c.opts);
    expect([up.kbX, up.kbY]).toEqual([0, -1]);
    expect(diag.kbX).toBeCloseTo(0.6, 12); expect(diag.kbY).toBeCloseTo(0.8, 12);
    expect([onTop.kbX, onTop.kbY]).toEqual([0, 0]);
    expect(fake.callsOf('damage').map((c) => c.enemy)).toEqual(list.map((e) => e.id));
  });

  it('reaches enemies within 90 + their own radius, no further', () => {
    const { fake, list } = land(1, [
      { x: 300 + 90 + 20 - 1, y: 400 }, // just inside (radius 20)
      { x: 300 + 90 + 20 + 5, y: 400 }, // just outside
      { x: 300 + 90 + 40 - 1, y: 400, radius: 40 }, // a big one reaches further
      { x: 300 + 91, y: 400, radius: 0 }, // radius 0: 90 exactly is the limit
    ]);
    expect(fake.callsOf('damage').map((c) => c.enemy)).toEqual([list[0].id, list[2].id]);
  });

  it('skips dead and still-spawning enemies', () => {
    const { fake } = arena([at('toaster'), far('bumper')]);
    const dead = fake.spawnEnemy({ x: 310, y: 400 }); dead.alive = false;
    fake.spawnEnemy({ x: 320, y: 400, state: 'spawn' });
    fake.hooks.emit('onDashEnd', landing);
    expect(fake.callsOf('damage')).toEqual([]);
    expect(fake.callsOf('sound')).toHaveLength(1); // the blast itself still goes off
  });

  it('scales the damage with the tier (8 / 12 / 16, ★4: 20) and keeps the radius flat', () => {
    for (const [tier, dmg] of [[1, 8], [2, 12], [3, 16]] as const) expect(land(tier, [{ x: 330, y: 400 }]).fake.callsOf('damage')[0].dmg).toBe(dmg);
    const { fake } = arena([at('toaster'), corner('bumper', 3), gilded(1)]);
    fake.spawnEnemy({ x: 330, y: 400 });
    fake.hooks.emit('onDashEnd', landing);
    expect(fake.callsOf('damage')[0].dmg).toBe(20);
    expect(fake.callsOf('fx')[0].args[3]).toBe(180);
  });

  it('is one blast however many copies: the best copy counts once', () => {
    const { fake } = arena([at('toaster'), far('bumper', 1), far('bumper', 3)]);
    fake.spawnEnemy({ x: 330, y: 400 });
    fake.hooks.emit('onDashEnd', landing);
    expect(fake.callsOf('damage')).toHaveLength(1);
    expect(fake.callsOf('damage')[0].dmg).toBe(16);
  });

  it('a kill by the shockwave goes through the normal pipeline (the enemy dies, no extra draw)', () => {
    const { list } = land(1, [{ x: 330, y: 400, hp: 5 }]);
    expect(list[0].alive).toBe(false);
  });

  it('does nothing without the item', () => {
    const { fake } = arena([at('toaster')]);
    fake.spawnEnemy({ x: 310, y: 400 });
    fake.hooks.emit('onDashEnd', landing);
    expect(fake.calls).toEqual([]);
  });
});

describe('Slam Bumper: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('bumper')).toBe(bumper);
    expect(ITEMS.bumper).toMatchObject({ id: 'bumper', family: 'tools', element: 'blast', name: 'Slam Bumper', kind: 'passive', price: 11, electrical: false });
    expect(ITEMS.bumper.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.bumper.rules).toBe('The Space dash ends in a shockwave: {0} damage within 90 and knockback (does not stack). Enables Pot Slam next to a Pressure Cooker.');
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('bumper', t).slam)).toEqual([8, 12, 16, 20]);
    expect(contentTune('bumper', 1).radius).toBe(90);
  });

  it('keeps its position in the item order', () => {
    expect(around('bumper', 1, 1)).toEqual(['boot', 'bumper', 'sparewheel']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect(itemRules('bumper', 2)).toBe('The Space dash ends in a shockwave: 12 damage within 90 and knockback (does not stack). Enables Pot Slam next to a Pressure Cooker.');
    setLang('de');
    expect(itemRules('bumper', 3)).toBe('Der Leertasten-Dash endet in einer Druckwelle: 16 Schaden im Umkreis von 90 und Rückstoß (stapelt sich nicht). Schaltet Topf-Slam neben einem Schnellkochtopf frei.');
    expect(itemT('bumper')).toMatchObject({ name: 'Rammschutz', blurb: 'Lande den Dash mit einem Knall.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('bumper')).toEqual([{ label: 'Landing blast', values: ['8', '12', '16'] }]);
    setLang('de');
    expect(tierScaling('bumper')).toEqual([{ label: 'Landeknall', values: ['8', '12', '16'] }]);
  });
});
