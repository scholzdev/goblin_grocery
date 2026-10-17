import { describe, expect, it } from 'vitest';
import { ELITE_AFFIXES, ENEMIES, affixArmor } from '../src/data/enemies';
import { SHRED } from '../src/engine/define';
import { FakeCtx } from '../src/engine/fakeCtx';
import { isBlastHit } from '../src/engine/onHitStatuses';
import { applyShred, armorDamage, hitArmor, newStatus, shredStacks, shreddedArmorDamage } from '../src/systems/combat';
import { UI } from '../src/i18n/ui';

// Shred (docs/item-hooks-refactor.md "Shred"): the status, the armor math both the scene and the FakeCtx use, the explosion source and the plated affix.

describe('SHRED constants', () => {
  it('cap 3, 4 s, extra damage at most half the hit', () => {
    expect(SHRED).toEqual({ cap: 3, duration: 4, bonusShare: 0.5 });
  });
});

describe('applyShred', () => {
  it('stacks, up to the cap', () => {
    const s = newStatus();
    applyShred(s, 1, 4, 0);
    expect(shredStacks(s, 0)).toBe(1);
    applyShred(s, 1, 4, 1);
    expect(shredStacks(s, 1)).toBe(2);
    applyShred(s, 5, 4, 2);
    expect(s.shredStacks).toBe(SHRED.cap);
    applyShred(s, 1, 4, 3);
    expect(s.shredStacks).toBe(SHRED.cap);
  });

  it('shares one timer: a new application refreshes it to the later end, a shorter one never cuts it', () => {
    const s = newStatus();
    applyShred(s, 1, 4, 0);
    expect(s.shredUntil).toBe(4);
    applyShred(s, 1, 4, 2);
    expect(s.shredUntil).toBe(6);
    applyShred(s, 1, 1, 3); // ends at 4, the running one ends at 6
    expect(s.shredUntil).toBe(6);
  });

  it('the stacks expire together: nothing counts after the end, and a new application starts from zero', () => {
    const s = newStatus();
    applyShred(s, 2, 4, 0);
    applyShred(s, 1, 4, 3); // 3 stacks until 7
    expect(shredStacks(s, 6.9)).toBe(3);
    expect(shredStacks(s, 7)).toBe(0);
    applyShred(s, 1, 4, 10);
    expect(s.shredStacks).toBe(1);
    expect(s.shredUntil).toBe(14);
  });
});

describe('armor math', () => {
  // armor, stacks, dmg -> damage dealt (the armor 3 floor is Canned Beans' minShare 0.3)
  const table: [string, number, number, number, number][] = [
    ['armor, no shred: soaks 3', 3, 0, 9, 6],
    ['armor, no shred: the 30% floor (a 4 hit loses 2, not 3)', 3, 0, 4, 2],
    ['eff > 0 (3 - 1 = 2)', 3, 1, 9, 7],
    ['eff > 0 (3 - 2 = 1)', 3, 2, 9, 8],
    ['eff = 0 (3 - 3)', 3, 3, 9, 9],
    ['no armor, no shred', 0, 0, 9, 9],
    ['eff < 0, flat (0 - 1): +1', 0, 1, 9, 10],
    ['eff < 0, flat (0 - 3): +3', 0, 3, 9, 12],
    ['eff < 0, capped at 50% (a 3 hit with 3 stacks: +2, not +3)', 0, 3, 3, 5],
    ['eff < 0, capped, rounded up (a 5 hit: +3)', 0, 3, 5, 8],
    ['eff < 0, a 1 hit with 1 stack: the cap is 1', 0, 1, 1, 2],
    ['plated beans (6) with 3 stacks: still armor 3', 6, 3, 9, 6],
    ['plated beans (6) with 3 stacks, a 20 hit', 6, 3, 20, 17],
  ];
  for (const [name, armor, stacks, dmg, out] of table) it(name, () => expect(shreddedArmorDamage(dmg, armor, stacks)).toBe(out));

  it('with no stacks it is exactly the old armor formula, for every damage and armor', () => {
    for (const armor of [0, 1, 3, 6]) for (const dmg of [0.5, 1, 3, 4, 9, 13, 20.5, 100]) expect(shreddedArmorDamage(dmg, armor, 0), `${armor}/${dmg}`).toBe(armorDamage(dmg, armor));
  });

  it('a stack beyond the armor adds the bonus, bounded by `bonusShare` of the hit', () => {
    for (const dmg of [1, 2, 3, 5, 9, 20, 40]) for (const stacks of [1, 2, 3]) {
      const out = shreddedArmorDamage(dmg, 0, stacks);
      expect(out).toBeGreaterThan(dmg);
      expect(out - dmg).toBeLessThanOrEqual(Math.ceil(dmg * SHRED.bonusShare));
      expect(out - dmg).toBeLessThanOrEqual(stacks);
    }
  });

  describe('hitArmor: the step the scene and the FakeCtx share', () => {
    const enemy = (armor: number | undefined, stacks = 0) => { const status = newStatus(); if (stacks) applyShred(status, stacks, 4, 0); return { def: armor === undefined ? {} : { armor }, status }; };
    it('direct hits only: burn, poison and quiet ticks pass through armor and shred alike', () => {
      const e = enemy(3, 3);
      expect(hitArmor(e, 10, { isDot: true }, 0)).toBe(10);
      expect(hitArmor(e, 10, { quiet: true }, 0)).toBe(10);
      expect(hitArmor(enemy(0, 3), 10, { isDot: true }, 0)).toBe(10);
      expect(hitArmor(enemy(0, 3), 10, { quiet: true }, 0)).toBe(10);
      expect(hitArmor(enemy(0, 3), 10, {}, 0)).toBe(13);
    });
    it('reads the live stacks: they stop counting when the timer ends', () => {
      const e = enemy(3, 2);
      expect(hitArmor(e, 9, {}, 3.9)).toBe(8);
      expect(hitArmor(e, 9, {}, 4)).toBe(6);
    });
    it('an enemy without armor and without shred is untouched', () => {
      expect(hitArmor(enemy(undefined), 9, {}, 0)).toBe(9);
    });
  });
});

describe('the shared armor step in the FakeCtx pipeline', () => {
  it('armor soaks a direct hit, shred takes it off, and an unarmored enemy takes the bonus', () => {
    const fake = new FakeCtx();
    const beans = fake.spawnReal('beans', { hp: 1000 }), milk = fake.spawnReal('milk', { hp: 1000 });
    fake.hit(beans, 9, null);
    expect(1000 - beans.hp).toBe(6);
    fake.shred(beans, 3);
    fake.shred(milk, 3);
    fake.hit(beans, 9, null);
    fake.hit(milk, 9, null);
    expect(1000 - beans.hp).toBe(6 + 9);
    expect(1000 - milk.hp).toBe(12 - 0);
    fake.hit(milk, 9, null, { isDot: true });
    expect(1000 - milk.hp).toBe(12 + 9);
  });

  it('bosses are not immune, and the status ignores affinity (no tag, the seconds are exactly what was asked)', () => {
    const fake = new FakeCtx();
    const boss = fake.spawnReal('boss_frozen', { hp: 1000 });
    fake.shred(boss, 1, 2.5);
    expect(boss.status.shredStacks).toBe(1);
    expect(boss.status.shredUntil).toBe(2.5);
    const turkey = fake.spawnReal('turkey', { hp: 1000 }); // weak to heat and resists frost: the status time never scales
    fake.shred(turkey, 1);
    expect(turkey.status.shredUntil).toBe(SHRED.duration);
  });
});

describe('explosions shred (no Can Opener)', () => {
  it('a Party Popper pop, and a hit tagged blast, leave one stack; a blast WEAPON\'s own hit does not', () => {
    expect(isBlastHit({ fromPopper: true })).toBe(true);
    expect(isBlastHit({ tags: ['blast'] })).toBe(true);
    expect(isBlastHit({ tags: ['heat'] })).toBe(false);
    expect(isBlastHit({})).toBe(false);
    const fake = new FakeCtx();
    const a = fake.spawnReal('milk', { hp: 1000 }), b = fake.spawnReal('milk', { hp: 1000 }), c = fake.spawnReal('milk', { hp: 1000, x: 1000 });
    fake.popperBlast({ x: 0, y: 0 }, { damage: 10, radius: 100 });
    expect([a, b].map((e) => e.status.shredStacks)).toEqual([1, 1]);
    fake.damage(b, 10, null, { label: 'Bag It', tags: ['blast'] });
    expect(b.status.shredStacks).toBe(2);
    fake.hit(c, 10, null, { label: 'Nail' });
    expect(c.status.shredStacks).toBe(0);
  });

  it('the next hit on the milk takes the stack\'s bonus (+1 on a 10 hit)', () => {
    const fake = new FakeCtx();
    const m = fake.spawnReal('milk', { hp: 1000 });
    fake.popperBlast({ x: 0, y: 0 }, { damage: 10, radius: 100 });
    const before = m.hp;
    fake.hit(m, 10, null, { label: 'x' });
    expect(before - m.hp).toBe(11); // a plain hit is x1 on milk; the stack adds 1
  });
});

describe('plated affix', () => {
  it('+3 armor on top of the type\'s own; the other affixes change nothing', () => {
    expect(affixArmor(undefined, 'plated')).toBe(3);
    expect(affixArmor(ENEMIES.beans.armor, 'plated')).toBe(6);
    for (const a of ELITE_AFFIXES.filter((x) => x !== 'plated')) { expect(affixArmor(undefined, a)).toBeUndefined(); expect(affixArmor(3, a)).toBe(3); }
    expect(affixArmor(undefined)).toBeUndefined();
  });
  it('goes through the shared armor rule: plated milk takes 6 of a 9, plated beans 3 (the 30% floor), and shred strips it', () => {
    const milk = { def: { armor: affixArmor(undefined, 'plated') }, status: newStatus() }, beans = { def: { armor: affixArmor(3, 'plated') }, status: newStatus() };
    expect(hitArmor(milk, 9, {}, 0)).toBe(6);
    expect(hitArmor(beans, 9, {}, 0)).toBe(3); // 9 - 6 = 3, which is also the 30% floor (ceil 2.7)
    applyShred(milk.status, 3, 4, 0);
    applyShred(beans.status, 3, 4, 0);
    expect(hitArmor(milk, 9, {}, 0)).toBe(9);
    expect(hitArmor(beans, 9, {}, 0)).toBe(6);
  });
  it('is rollable and has a name in EN and DE', () => {
    expect(ELITE_AFFIXES).toContain('plated');
    expect(UI.en.affix_plated).toBe('Plated');
    expect(UI.de.affix_plated).toBe('Gepanzert');
  });
});
