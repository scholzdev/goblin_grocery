import { afterEach, describe, expect, it } from 'vitest';
import { arena, at, full } from '../helpers';
import { floorSpeed, healPlayer, useRunOnce } from '../../../src/engine/playerHealth';
import { createRun, finishWave, recomputeBuild, startNextWave } from '../../../src/state/run';
import { contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { PLAYER } from '../../../src/data/items';
import type { HitSource } from '../../../src/types';

const contact: HitSource = { how: 'contact', by: 'milk', origin: { x: 30, y: 0 } };
const vent: HitSource = { how: 'hazard', by: 'vents' };
const reset = (fake: ReturnType<typeof arena>['fake']) => { fake.player.invulnT = 0; fake.player.protectT = 0; };
afterEach(() => setLang('en'));

describe('Oven Mitts', () => {
  it('reduces close attacks at each tier, including shots, but not distant shots or hazards', () => {
    for (const [tier, reduction] of [[1, 0.2], [2, 0.25], [3, 0.3]]) {
      const { fake } = arena([at('ovenmitts', tier)], { hp: 100, maxHp: 100 });
      fake.hurt(10, contact);
      expect(fake.run.hp).toBeCloseTo(100 - 10 * (1 - reduction));
      reset(fake);
      fake.hurt(10, { how: 'shot', by: 'spitter', origin: { x: 30, y: 0 } });
      expect(fake.run.hp).toBeCloseTo(100 - 20 * (1 - reduction));
      reset(fake);
      fake.hurt(10, { how: 'shot', by: 'spitter', origin: { x: 900, y: 0 } });
      reset(fake);
      fake.hurt(10, vent);
      expect(fake.run.hp).toBeCloseTo(80 - 20 * (1 - reduction));
    }
  });
});

describe('Canned Soup', () => {
  it('adds max HP once, without healing on equip', () => {
    const s = createRun(1);
    s.hp = 5;
    s.inventory.placed.push({ uid: 'soup', type: 'soup', x: 4, y: 0, rot: 0 });
    recomputeBuild(s);
    expect(s.build.maxHp).toBe(PLAYER.maxHp + 20);
    expect(s.hp).toBe(5);
    expect(full([at('soup'), at('soup')]).maxHp).toBe(full([at('soup')]).maxHp);
  });

  it('heals on every third clear, not the first two, and can overfill a Thermos', () => {
    const s = createRun(1);
    s.build = full([at('soup'), at('thermos')]);
    s.hp = 1;
    for (let i = 0; i < 2; i++) finishWave(s);
    expect(s.hp).toBe(1 + 2 * PLAYER.repairBetweenWaves);
    finishWave(s);
    expect(s.hp).toBe(16 + 3 * PLAYER.repairBetweenWaves);
    s.hp = s.build.maxHp;
    finishWave(s); finishWave(s); finishWave(s);
    expect(s.shield).toBe(15);
  });
});

describe('Shopping Cart Helmet and Weighted Blanket', () => {
  it('helmet armor scales, floors damage at 1, and duplicate copies do not double it', () => {
    for (const [tier, armor] of [[1, 2], [2, 3], [3, 4]]) {
      const { fake } = arena([at('helmet', tier), at('helmet', tier)], { hp: 100, maxHp: 100 });
      fake.hurt(10, contact);
      expect(fake.run.hp).toBe(90 + armor);
      reset(fake); fake.hurt(1, contact);
      expect(fake.run.hp).toBe(89 + armor);
    }
  });

  it('blanket adds health, reduces damage and slows walking', () => {
    const { fake, b } = arena([at('blanket')], { hp: 100, maxHp: 100 });
    expect(b.maxHp).toBe(PLAYER.maxHp + 30);
    expect(b.moveSpeedMult).toBe(0.9);
    fake.hurt(10, contact);
    expect(fake.run.hp).toBe(91);
  });

  it('combines percentage reduction, armor, then shield regardless of cart ordering', () => {
    for (const specs of [[at('thermos'), at('helmet'), at('ovenmitts')], [at('ovenmitts'), at('thermos'), at('helmet')]]) {
      const { fake } = arena(specs, { hp: 100, maxHp: 100 });
      fake.heal(3);
      fake.hurt(10, contact); // 10 * 0.8 - 2 armor - 3 shield = 3 HP
      expect(fake.run.hp).toBe(97);
      expect(fake.run.shield).toBe(0);
    }
  });
});

describe('Frozen Peas', () => {
  it('starts after the first hit, refreshes on subsequent damage and expires', () => {
    const { fake } = arena([at('peas')], { hp: 100, maxHp: 100 });
    fake.hurt(10, contact);
    expect(fake.run.hp).toBe(90);
    fake.advance(1); reset(fake); fake.hurt(10, contact);
    expect(fake.run.hp).toBe(83);
    fake.advance(1.5); reset(fake); fake.hurt(10, contact);
    expect(fake.run.hp).toBe(76);
    fake.advance(2.1); reset(fake); fake.hurt(10, contact);
    expect(fake.run.hp).toBe(66);
  });

  it('does not trigger from a fully shielded or invulnerability-blocked hit', () => {
    const { fake } = arena([at('peas'), at('thermos')], { hp: 100, maxHp: 100 });
    fake.heal(15); fake.hurt(10, contact);
    expect(fake.run.hp).toBe(100);
    reset(fake); fake.hurt(15, contact);
    expect(fake.run.hp).toBe(90); // no reduction; remaining 5 shield spent
    fake.player.invulnT = 100;
    fake.advance(3); fake.hurt(10, contact);
    reset(fake); fake.hurt(10, contact);
    expect(fake.run.hp).toBe(80);
  });
});

describe('Emergency Sandwich', () => {
  it('heals below 25% once per aisle, with a fresh charge after hook recompilation', () => {
    const { fake } = arena([at('sandwich')], { hp: 30, maxHp: 100 });
    fake.hurt(10, contact);
    expect(fake.run.hp).toBe(40);
    expect(fake.lastHurtDamage).toBe(10);
    reset(fake); fake.hurt(20, contact);
    expect(fake.run.hp).toBe(20);
    const next = arena([at('sandwich')], { hp: fake.run.hp, maxHp: 100 }).fake;
    next.hurt(1, contact);
    expect(next.run.hp).toBe(39);
  });

  it('does not heal at exactly 25% or revive a fatal hit', () => {
    const { fake } = arena([at('sandwich')], { hp: 30, maxHp: 100 });
    fake.hurt(5, contact);
    expect(fake.run.hp).toBe(25);
    reset(fake); fake.hurt(100, contact);
    expect(fake.run.hp).toBe(0);
    expect(fake.player.dead).toBe(true);
  });
});

describe('Rubber Boots', () => {
  it('cuts floor damage, including freezer slush and electrical floor events, not contact or shots', () => {
    const { fake, b } = arena([at('rubberboots')], { hp: 100, maxHp: 100 });
    expect(b.floorSlowResist).toBe(0.5);
    for (const source of [vent, { how: 'event', by: 'powerSurge' }, { how: 'boss', by: 'boss_frozen' }, { how: 'boss', by: 'boss_checkout' }] as HitSource[]) {
      reset(fake); fake.hurt(10, source);
    }
    expect(fake.run.hp).toBe(80);
    reset(fake); fake.hurt(10, contact);
    expect(fake.run.hp).toBe(70);
    expect(floorSpeed(0.5, b.floorSlowResist)).toBe(0.75);
    expect(floorSpeed(1, b.floorSlowResist)).toBe(1);
    expect(floorSpeed(0.5)).toBe(0.5);
  });
});

describe('Thermos', () => {
  it('stores only excess healing, caps it, and supports partial and complete absorption', () => {
    const { fake } = arena([at('thermos')], { hp: 95, maxHp: 100 });
    fake.heal(10);
    expect(fake.run.hp).toBe(100);
    expect(fake.run.shield).toBe(5);
    fake.heal(100);
    expect(fake.run.shield).toBe(15);
    fake.hurt(10, contact);
    expect(fake.run.hp).toBe(100);
    expect(fake.run.shield).toBe(5);
    reset(fake); fake.hurt(10, contact);
    expect(fake.run.hp).toBe(95);
    expect(fake.run.shield).toBe(0);
  });

  it('persists between aisles and is clamped or cleared when equipment changes', () => {
    const s = createRun(1);
    s.inventory.placed.push({ uid: 'thermos', type: 'thermos', x: 4, y: 0, rot: 0, tier: 3 });
    recomputeBuild(s); s.hp = s.build.maxHp;
    healPlayer(s, s.build, 100);
    expect(s.shield).toBe(30);
    startNextWave(s);
    expect(s.shield).toBe(30);
    s.inventory.placed.at(-1)!.tier = 1;
    recomputeBuild(s);
    expect(s.shield).toBe(15);
    s.inventory.placed.pop(); recomputeBuild(s);
    expect(s.shield).toBe(0);
  });

  it('healing never revives a dead player or creates negative shields', () => {
    const { fake } = arena([at('thermos')], { hp: 0, maxHp: 100 });
    fake.heal(100); fake.heal(-10);
    expect(fake.run.hp).toBe(0);
    expect(fake.run.shield ?? 0).toBe(0);
  });
});

describe('Loyalty Life Insurance', () => {
  it('revives a fatal hit at half max HP and grants 3 seconds of invulnerability, once', () => {
    const { fake } = arena([at('insurance')], { hp: 10, maxHp: 100 });
    fake.hurt(100, contact);
    expect(fake.run.hp).toBe(50);
    expect(fake.player.invulnT).toBe(3);
    expect(fake.player.dead).toBe(false);
    reset(fake); fake.hurt(50, contact);
    expect(fake.player.dead).toBe(true);
  });

  it('does not spend its charge on nonlethal or fully absorbed hits', () => {
    const { fake } = arena([at('insurance'), at('thermos')], { hp: 5, maxHp: 100 });
    fake.run.shield = 15;
    fake.hurt(10, contact);
    expect(fake.run.itemUses).toBeUndefined();
    reset(fake); fake.hurt(7, contact); // 5 shield, 2 HP damage
    expect(fake.run.itemUses).toBeUndefined();
    reset(fake); fake.hurt(10, contact);
    expect(fake.run.hp).toBe(50);
  });

  it('revives from 1 HP and cannot reset between aisles or copies', () => {
    const { fake } = arena([at('insurance'), at('insurance')], { hp: 1, maxHp: 100 });
    fake.hurt(1, contact);
    expect(fake.run.hp).toBe(50);
    expect(fake.player.invulnT).toBe(3);
    const next = arena([at('insurance')], { hp: 10, maxHp: 100 }).fake;
    next.run.itemUses = structuredClone(fake.run.itemUses);
    next.hurt(100, contact);
    expect(next.player.dead).toBe(true);
    const s = createRun(1);
    expect(useRunOnce(s, 'insurance')).toBe(true);
    startNextWave(s);
    expect(useRunOnce(s, 'insurance')).toBe(false);
  });

  it('also lands at half HP when a fatal hit starts above half, and scales with max HP', () => {
    const { fake } = arena([at('insurance')], { hp: 100, maxHp: 121 });
    fake.hurt(200, contact);
    expect(fake.run.hp).toBe(61);
    expect(fake.player.dead).toBe(false);
    expect(fake.run.itemUses?.insurance).toBe(true);
  });
});

describe('durability content', () => {
  const ids = ['ovenmitts', 'soup', 'helmet', 'peas', 'sandwich', 'blanket', 'rubberboots', 'thermos', 'insurance'] as const;
  it('renders EN/DE text and tier rows for all nine items without unresolved placeholders', () => {
    for (const lang of ['en', 'de'] as const) {
      setLang(lang);
      for (const id of ids) for (const tier of [1, 2, 3]) {
        expect(itemT(id).name.length).toBeGreaterThan(2);
        expect(itemRules(id, tier)).not.toMatch(/[{}]/);
        expect(tierScaling(id)).toBeDefined();
      }
    }
    expect(contentTune('peas', 3).reduction).toBe(0.4);
    expect(contentTune('thermos', 3).cap).toBe(30);
  });
});
