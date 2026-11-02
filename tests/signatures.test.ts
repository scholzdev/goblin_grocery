import { describe, expect, it } from 'vitest';
import { PLAYER, SIGNATURE, signatureOf } from '../src/data/items';
import { UI } from '../src/i18n/ui';
import { createRun, mergeItems, newUid, openShop, reroll } from '../src/state/run';
import { currentRerollCost } from '../src/systems/shop';
import { dashCooldownAfterKill, firstHitCrit } from '../src/systems/signatures';
import { isDashHit } from '../src/engine/hitTags';
import { mulberry32 } from '../src/systems/rng';
import type { StarterId } from '../src/types';

const STARTERS = Object.keys(PLAYER.starters) as StarterId[];

describe('goblin signatures', () => {
  it('every goblin has one, with text in both languages', () => {
    expect(STARTERS.map(signatureOf)).toEqual(['firstCrit', 'mergeHeal', 'freeReroll', 'dashCooldown']);
    for (const id of STARTERS) { expect(UI.en[`sig_${id}` as keyof typeof UI.en]).toBeTruthy(); expect(UI.de[`sig_${id}` as keyof typeof UI.de]).toBeTruthy(); }
  });

  it('Toast Goblin: each weapon crits on its first hit of the aisle only; other goblins never', () => {
    const seen = new Set<string>();
    expect(firstHitCrit('toaster', seen, 'w1')).toBe(true);
    expect(firstHitCrit('toaster', seen, 'w1')).toBe(false);
    expect(firstHitCrit('toaster', seen, 'w2')).toBe(true);
    expect(firstHitCrit('toaster', new Set(), 'w1')).toBe(true); // a new aisle starts with an empty set
    for (const other of ['pan', 'coupon', 'night'] as const) expect(firstHitCrit(other, new Set(), 'w1')).toBe(false);
  });

  it('Line Cook: a merge heals 5 HP (capped at max HP); other goblins heal nothing', () => {
    const mk = (starter: StarterId) => {
      const s = createRun(1, starter);
      s.phase = 'shop';
      s.inventory.shelf[0] = { uid: newUid(s), type: 'fan', x: 0, y: 0, rot: 0, tier: 1 };
      s.inventory.shelf[1] = { uid: newUid(s), type: 'fan', x: 0, y: 0, rot: 0, tier: 1 };
      return s;
    };
    const cook = mk('pan');
    cook.hp = 10;
    expect(mergeItems(cook, cook.inventory.shelf[0]!.uid, cook.inventory.shelf[1]!.uid).ok).toBe(true);
    expect(cook.hp).toBe(10 + SIGNATURE.mergeHeal.hp);
    const full = mk('pan');
    full.hp = full.build.maxHp - 2;
    mergeItems(full, full.inventory.shelf[0]!.uid, full.inventory.shelf[1]!.uid);
    expect(full.hp).toBe(full.build.maxHp);
    const toast = mk('toaster');
    toast.hp = 10;
    mergeItems(toast, toast.inventory.shelf[0]!.uid, toast.inventory.shelf[1]!.uid);
    expect(toast.hp).toBe(10);
  });

  it('Coupon Clipper: the first reroll of every shop is free; it stacks with automatic shop progression', () => {
    const shop = (starter: StarterId, level = 1) => {
      const s = createRun(1, starter);
      s.wave = level === 3 ? 5 : 2; s.money = 100;
      openShop(s, mulberry32(1));
      return s;
    };
    const s = shop('coupon');
    expect(currentRerollCost(s)).toBe(0);
    expect(reroll(s, mulberry32(2)).ok).toBe(true);
    expect(s.money).toBe(100);
    expect(currentRerollCost(s)).toBeGreaterThan(0);
    const other = shop('toaster');
    expect(currentRerollCost(other)).toBeGreaterThan(0);
    const loyal = shop('coupon', 3); // Aisle 5 adds its own free reroll.
    reroll(loyal, mulberry32(2)); reroll(loyal, mulberry32(3));
    expect(loyal.money).toBe(100);
    expect(currentRerollCost(loyal)).toBeGreaterThan(0);
    openShop(s, mulberry32(4)); // a new shop: free again
    expect(currentRerollCost(s)).toBe(0);
  });

  it('Night Shift: a dash kill takes 0.5 s off the dash cooldown (not below 0); other kills and goblins do not', () => {
    expect(dashCooldownAfterKill('night', 2, true)).toBe(1.5);
    expect(dashCooldownAfterKill('night', 0.3, true)).toBe(0);
    expect(dashCooldownAfterKill('night', 2, false)).toBe(2);
    for (const other of ['toaster', 'pan', 'coupon'] as const) expect(dashCooldownAfterKill(other, 2, true)).toBe(2);
    expect(isDashHit({ label: 'shove' })).toBe(true);
    expect(isDashHit({ label: 'bag' })).toBe(false);
    expect(isDashHit({})).toBe(false);
  });
});
