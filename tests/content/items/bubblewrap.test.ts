import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER } from '../../../src/data/items';
import bubblewrap from '../../../src/content/items/bubblewrap';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, far, gilded } from '../helpers';

/** The 3x1 wrap in the bottom-right corner (a Gold Star can sit against it without touching the weapon). */
const wrapCorner = (tier: number) => at('bubblewrap', tier, { near: [], apart: [0], at: [5, 4] });

afterEach(() => setLang('en'));

const scenes = import.meta.glob(['../../../src/scenes/ArenaScene.ts', '../../../src/state/run.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const source = (file: string): string => Object.entries(scenes).find(([k]) => k.endsWith(`/${file}`))![1];

// The armor is an `onPlayerHit` hook now (it used to be applied in run.damagePlayer, the i-frame bonus in hurtPlayer). FakeCtx.hurt mirrors hurtPlayer.
describe('Bubble Wrap: runtime', () => {
  const hurt = (tier: number, dmg: number, extra: Parameters<typeof arena>[0] = []) => {
    const { fake } = arena([at('toaster'), far('bubblewrap', tier), ...extra], { hp: 40, maxHp: 40 });
    fake.hurt(dmg);
    return fake;
  };

  it('soaks (tier) damage per hit but never below 1: ★1 / ★2 / ★3', () => {
    expect([1, 2, 3].map((t) => 40 - hurt(t, 5).run.hp)).toEqual([4, 3, 2]);
    expect([1, 2, 3].map((t) => 40 - hurt(t, 1).run.hp)).toEqual([1, 1, 1]);
    expect([1, 2, 3].map((t) => 40 - hurt(t, 3).run.hp)).toEqual([2, 1, 1]);
  });

  it('matches the legacy damagePlayer formula max(1, damage - armor) for every tier and a range of damages', () => {
    for (const tier of [1, 2, 3]) for (const dmg of [0.5, 1, 1.5, 2, 3, 4, 5, 8, 10, 12]) expect(40 - hurt(tier, dmg).run.hp, `★${tier} ${dmg}`).toBe(Math.max(1, dmg - tier));
  });

  it('Gold Star\'s effective ★4 soaks 4', () => {
    const { fake } = arena([at('toaster'), wrapCorner(3), gilded(1)], { hp: 40, maxHp: 40 });
    fake.hurt(10);
    expect(fake.run.hp).toBe(34);
  });

  it('adds 0.25 s to the post-hit invulnerability (0.6 + 0.25)', () => {
    expect(hurt(1, 5).player.invulnT).toBe(PLAYER.invuln + 0.25);
    const { fake } = arena([at('toaster')], { hp: 40, maxHp: 40 });
    fake.hurt(5);
    expect(fake.player.invulnT).toBe(PLAYER.invuln);
    expect(fake.run.hp).toBe(35); // no armor without the item
  });

  it('does not run while the goblin is invulnerable (the i-frame check comes first): nothing is taken, nothing extends', () => {
    const fake = hurt(1, 5);
    const hp = fake.run.hp, t = fake.player.invulnT;
    fake.hurt(5);
    expect([fake.run.hp, fake.player.invulnT]).toEqual([hp, t]);
  });

  it('does not stack: two copies soak the best one, once', () => {
    const { fake } = arena([at('toaster'), far('bubblewrap', 1), far('bubblewrap', 2)], { hp: 40, maxHp: 40 });
    fake.hurt(10);
    expect(fake.run.hp).toBe(32);
    expect(fake.player.invulnT).toBe(PLAYER.invuln + 0.25);
  });

  it('a lethal hit still kills (the armor applies before the hp is taken)', () => {
    const { fake } = arena([at('toaster'), far('bubblewrap', 3)], { hp: 2, maxHp: 40 });
    fake.hurt(5); // 5 - 3 = 2 damage
    expect(fake.run.hp).toBe(0);
    expect(fake.player.dead).toBe(true);
  });
});

// Guards for the scene side: nothing reads the armor or the i-frame bonus there any more.
describe('Bubble Wrap: the legacy reads are gone', () => {
  it('run.damagePlayer takes the amount as given, hurtPlayer starts from PLAYER.invuln', () => {
    expect(source('run.ts')).not.toMatch(/build\.armor/);
    const arena_ = source('ArenaScene.ts');
    expect(arena_).not.toContain('invulnBonus');
    const hurt = arena_.slice(arena_.indexOf('hurtPlayer(dmg: number)'), arena_.indexOf('enemySwipe('));
    expect(hurt.indexOf('let invuln = PLAYER.invuln;')).toBeGreaterThan(-1);
    expect(hurt.indexOf("emit('onPlayerHit'")).toBeLessThan(hurt.indexOf('damagePlayer(store.state, dmg)'));
  });
});

describe('Bubble Wrap: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('bubblewrap')).toBe(bubblewrap);
    expect(ITEMS.bubblewrap).toMatchObject({ id: 'bubblewrap', family: 'checkout', kind: 'passive', price: 10, electrical: false });
    expect(ITEMS.bubblewrap.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('bubblewrap', t).armor)).toEqual([1, 2, 3, 4]);
    expect(contentTune('bubblewrap', 1).invuln).toBe(0.25);
  });

  it('keeps its position in the item order', () => {
    expect(around('bubblewrap', 1, 1)).toEqual(['coupon', 'bubblewrap', 'energy']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect(itemRules('bubblewrap', 3)).toBe('Take 3 less damage from every hit (minimum 1) and +0.25 s invulnerability after being hit (does not stack).');
    setLang('de');
    expect(itemRules('bubblewrap', 2)).toBe('Nimm 2 Schaden weniger pro Treffer (mindestens 1) und +0,25 s Unverwundbarkeit nach einem Treffer (stapelt sich nicht).');
    expect(itemT('bubblewrap')).toMatchObject({ name: 'Luftpolsterfolie', blurb: 'Platzsichere Polsterung für deinen Wagen.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('bubblewrap')).toEqual([{ label: 'Armor', values: ['1', '2', '3'] }]);
    setLang('de');
    expect(tierScaling('bubblewrap')).toEqual([{ label: 'Rüstung', values: ['1', '2', '3'] }]);
  });
});
