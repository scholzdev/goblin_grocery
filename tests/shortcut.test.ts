import { describe, expect, it } from 'vitest';
import { MINI_BOSS } from '../src/data/enemies';
import { ITEMS } from '../src/data/items';
import { BOSS_WAVE } from '../src/data/waves';
import { chooseDoor, createRun, leaveShop, newUid, openShop, sellItem, startNextWave } from '../src/state/run';
import { rollDoors, rollOffers, sellPrice } from '../src/systems/shop';
import { botDoors, canShortcut, findKey } from '../src/systems/shortcut';
import { mulberry32 } from '../src/systems/rng';
import { contentTune } from '../src/engine/registry';
import type { RunState } from '../src/types';

/** A run in the shop after `cleared` aisles, holding a Shortcut Key (cart or shelf). */
const shopWithKey = (cleared: number, opts: { shelf?: boolean; level?: number } = {}): RunState => {
  const s = createRun(3);
  s.wave = cleared;
  s.shopLevel = opts.level ?? 1;
  const key = { uid: newUid(s), type: 'shortcut' as const, x: 3, y: 3, rot: 0 as const };
  if (opts.shelf) s.inventory.shelf[0] = key; else s.inventory.placed.push(key);
  openShop(s, mulberry32(1));
  return s;
};

describe('Shortcut Key', () => {
  it('never skips the mini-boss aisle or the boss aisle, and the item text says which', () => {
    expect(contentTune('shortcut', 1)).toMatchObject({ mini: MINI_BOSS.aisle, boss: BOSS_WAVE });
    for (let cleared = 1; cleared <= 7; cleared++) {
      const s = shopWithKey(cleared);
      const skipped = cleared + 1;
      expect(canShortcut(s, cleared), `skip aisle ${skipped}`).toBe(skipped !== MINI_BOSS.aisle && skipped !== BOSS_WAVE);
    }
    expect(MINI_BOSS.aisle).toBe(4);
    expect(BOSS_WAVE).toBe(8);
  });

  it('is offered as the last door only while an unused key is owned (cart or shelf), never in overtime', () => {
    for (let seed = 0; seed < 60; seed++) {
      for (const level of [1, 3]) {
        const s = shopWithKey(2, { level, shelf: seed % 2 === 0 });
        const doors = rollDoors(s, mulberry32(seed));
        expect(doors.at(-1)).toBe('shortcut');
        expect(doors.filter((d) => d === 'shortcut')).toHaveLength(1);
        expect(doors).toHaveLength(level >= 3 ? 4 : 3);
      }
      expect(rollDoors(shopWithKey(3), mulberry32(seed))).not.toContain('shortcut'); // would skip aisle 4
      expect(rollDoors(shopWithKey(7), mulberry32(seed))).toEqual(['boss']);
      const plain = createRun(3); plain.wave = 2; openShop(plain, mulberry32(1));
      expect(rollDoors(plain, mulberry32(seed))).not.toContain('shortcut');
      const ot = shopWithKey(10); ot.overtime = true;
      expect(rollDoors(ot, mulberry32(seed))).not.toContain('shortcut');
    }
  });

  it('skips exactly one aisle, heals fully, keeps the route in step and spends the key', () => {
    for (const cleared of [1, 2, 4, 5, 6]) {
      const s = shopWithKey(cleared, { shelf: cleared % 2 === 0 });
      s.hp = 3;
      const routeLen = s.route.length;
      expect(leaveShop(s, mulberry32(9)).ok).toBe(true);
      expect(s.doors).toContain('shortcut');
      expect(chooseDoor(s, 'shortcut').ok).toBe(true);
      startNextWave(s);
      expect(s.wave).toBe(cleared + 2);
      expect(s.phase).toBe('combat');
      expect(s.hp).toBe(s.build.maxHp);
      expect(s.skipped).toBe(cleared + 1);
      expect([s.route.length, s.mods.length, s.zones.length]).toEqual([routeLen + 2, routeLen + 2, routeLen + 2]);
      expect(s.modifier).toBe('none');
      expect(s.stats.wavesCleared).toBe(0); // a skipped aisle is not a clear
      expect(findKey(s.inventory)).toBeNull();
      expect([...s.inventory.placed, ...s.inventory.shelf].some((i) => i?.type === 'spentkey')).toBe(true);
    }
  });

  it('skipping aisle 7 lands on the boss aisle at full health; a second use is impossible', () => {
    const s = shopWithKey(6);
    s.hp = 1;
    leaveShop(s, mulberry32(2));
    expect(chooseDoor(s, 'shortcut').ok).toBe(true);
    startNextWave(s);
    expect([s.wave, s.department, s.zone, s.hp]).toEqual([BOSS_WAVE, 'boss', null, s.build.maxHp]);
    const again = shopWithKey(1);
    again.phase = 'route'; again.doors = ['none', 'shortcut'];
    expect(chooseDoor(again, 'shortcut').ok).toBe(true);
    again.phase = 'route'; again.doors = ['none', 'shortcut'];
    expect(chooseDoor(again, 'shortcut').ok).toBe(false);
  });

  it('refuses the door when the skip would be illegal even if it was listed', () => {
    const s = shopWithKey(3);
    s.phase = 'route'; s.doors = ['none', 'shortcut'];
    const before = structuredClone(s);
    expect(chooseDoor(s, 'shortcut').ok).toBe(false);
    expect(s).toEqual(before);
  });

  it('the Spent Key sells for 1, is never offered, and is never missing from the item list', () => {
    expect(ITEMS.spentkey.noShop).toBe(true);
    expect(sellPrice('spentkey')).toBe(contentTune('spentkey', 1).sell);
    expect(sellPrice('spentkey')).toBe(1);
    const s = shopWithKey(1);
    s.unlocked = undefined;
    for (let seed = 0; seed < 300; seed++) expect(rollOffers(s, mulberry32(seed), 2 + (seed % 6)).map((o) => o.type)).not.toContain('spentkey');
    const spent = createRun(1);
    spent.phase = 'shop';
    spent.inventory.shelf[0] = { uid: 'k', type: 'spentkey', x: 0, y: 0, rot: 0 };
    const money = spent.money;
    expect(sellItem(spent, 'k').ok).toBe(true);
    expect(spent.money).toBe(money + 1);
  });

  it('a Test Lab / sim aisle keeps its single door and adds Staff Only while a key is owned', () => {
    const s = shopWithKey(2);
    s.lab = true;
    leaveShop(s, mulberry32(1));
    expect(s.doors).toEqual(['none', 'shortcut']);
    expect(chooseDoor(s, 'shortcut').ok).toBe(true);
    startNextWave(s);
    expect(s.wave).toBe(4);
    const plain = createRun(1); plain.lab = true; plain.wave = 2; openShop(plain, mulberry32(1));
    leaveShop(plain, mulberry32(1));
    expect(plain.doors).toEqual(['none']);
  });

  it('bots ignore the Staff Only door unless badly hurt', () => {
    const s = createRun(1);
    expect(botDoors(['none', 'rush', 'shortcut'], s)).toEqual(['none', 'rush']);
    s.hp = 5;
    expect(botDoors(['none', 'rush', 'shortcut'], s)).toEqual(['shortcut']);
    expect(botDoors(['none', 'rush'], s)).toEqual(['none', 'rush']);
  });
});
