import { describe, expect, it } from 'vitest';
import { GOALS } from '../src/data/contracts';
import { cartTags, eligibleGoals, killCounts, punchHit, punchKill, punchTick, punchTier, punchView, rollPunchCard, type PunchCard } from '../src/systems/contracts';
import { createRun, finishWave, openShop, payPunchCard, newUid } from '../src/state/run';
import { mulberry32 } from '../src/systems/rng';
import { contentTune } from '../src/engine/registry';
import type { ItemInstance, ItemTypeId } from '../src/types';

const inst = (type: ItemTypeId, tier = 1): ItemInstance => ({ uid: `u${type}${tier}`, type, x: 0, y: 0, rot: 0, tier });
const inv = (...types: ItemTypeId[]) => ({ placed: types.map((t) => inst(t)) });
const FIGHT = { aisle: 4, boss: false, total: 55, fight: true };
const ids = (tags: Set<never> | ReadonlySet<never>, a = FIGHT) => eligibleGoals(tags as never, a).map((g) => g.id);

describe('Punch Card goals', () => {
  it('filters elemental goals by the tags the cart can deal', () => {
    expect(cartTags(inv('fuel')).has('heat')).toBe(true);
    expect(cartTags(inv('ice')).has('frost')).toBe(true);
    expect(ids(cartTags(inv('vacuum')) as never)).not.toContain('heat');
    expect(ids(cartTags(inv('vacuum', 'fuel')) as never)).toContain('heat');
    expect(ids(cartTags(inv('vacuum', 'fuel')) as never)).not.toContain('frost');
    expect(ids(cartTags(inv('vacuum', 'ice')) as never)).toContain('frost');
  });

  it('a Jelly Beans flavor counts as a cart tag', () => {
    const jb = { ...inst('jellybeans'), flavor: 'blast' as const };
    expect(cartTags({ placed: [jb] }).has('blast')).toBe(true);
  });

  it('always offers dash, any and no-hit; elites only from aisle 4; the boss aisle only the hit-free goal; no fight, no goal', () => {
    const none = new Set<never>();
    expect(ids(none, { ...FIGHT, aisle: 1 })).toEqual(['dash', 'any', 'nohit']);
    expect(ids(none, { ...FIGHT, aisle: 3 })).not.toContain('elite');
    expect(ids(none, { ...FIGHT, aisle: 4 })).toContain('elite');
    expect(ids(none, { aisle: 8, boss: true, total: 6, fight: true })).toEqual(['nohit']);
    expect(ids(none, { ...FIGHT, fight: false })).toEqual([]);
  });

  it('targets follow the aisle size and stay inside the table bounds; heat is 20 at 55 groceries', () => {
    const heat = (total: number) => eligibleGoals(new Set(['heat']) as never, { ...FIGHT, total }).find((g) => g.id === 'heat')!.target;
    expect(heat(55)).toBe(20);
    for (const total of [6, 19, 30, 55, 86, 400]) {
      for (const g of eligibleGoals(new Set(['heat', 'frost', 'electric', 'blast']) as never, { ...FIGHT, total })) {
        const def = GOALS.find((d) => d.id === g.id)!;
        if (def.kind === 'kills') { expect(g.target).toBeGreaterThanOrEqual(def.min); expect(g.target).toBeLessThanOrEqual(def.max); }
      }
    }
    expect(heat(30)).toBeLessThan(heat(86));
  });

  it('rolls only goals the cart can meet, deterministically, and nothing without a Punch Card in the cart', () => {
    expect(rollPunchCard(1, inv('pan'), FIGHT)).toBeNull();
    expect(rollPunchCard(1, { placed: [] }, FIGHT)).toBeNull();
    const cart = inv('vacuum', 'punchcard');
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const card = rollPunchCard(seed, cart, { ...FIGHT, aisle: 1 + (seed % 3) })!;
      seen.add(card.goal);
      expect(['dash', 'any', 'nohit']).toContain(card.goal);
      expect(rollPunchCard(seed, cart, { ...FIGHT, aisle: 1 + (seed % 3) })).toEqual(card);
    }
    expect(seen.size).toBe(3);
    expect(rollPunchCard(9, inv('punchcard'), { ...FIGHT, fight: false })).toBeNull();
  });

  it('the reward follows the Punch Card tier (5 / 8 / 12 coins); only a card in the cart counts', () => {
    expect([1, 2, 3].map((t) => contentTune('punchcard', t).coins)).toEqual([5, 8, 12]);
    expect(punchTier({ placed: [inst('punchcard', 2), inst('punchcard', 3)] })).toBe(3);
    expect(rollPunchCard(1, { placed: [inst('punchcard', 2)] }, FIGHT)!.coins).toBe(8);
  });
});

const card = (goal: PunchCard['goal'], target: number): PunchCard => ({ goal, target, progress: 0, status: 'active', coins: 8 });
const kill = (o: Partial<Parameters<typeof killCounts>[1]> = {}) => ({ tags: [], dash: false, elite: false, ...o });

describe('Punch Card progress', () => {
  it('counts only matching kills and completes on the last one', () => {
    const p = card('heat', 3);
    expect(punchKill(p, kill({ tags: ['frost'] }))).toBeNull();
    expect(p.progress).toBe(0);
    expect(punchKill(p, kill({ tags: ['heat'] }))).toBeNull();
    expect(punchKill(p, kill({ tags: ['heat', 'blast'] }))).toBeNull();
    expect(punchKill(p, kill({ tags: ['heat'] }))).toBe('done');
    expect([p.progress, p.status]).toEqual([3, 'done']);
    expect(punchKill(p, kill({ tags: ['heat'] }))).toBeNull(); // done stays done
    expect(p.progress).toBe(3);
  });

  it('dash, elite and any goals read their own flag', () => {
    expect(killCounts('dash', kill({ dash: true }))).toBe(true);
    expect(killCounts('dash', kill({ elite: true }))).toBe(false);
    expect(killCounts('elite', kill({ elite: true }))).toBe(true);
    expect(killCounts('any', kill())).toBe(true);
    expect(killCounts('nohit', kill({ dash: true }))).toBe(false);
  });

  it('no-hit: the streak fills with time, a hit empties it, reaching the target completes it', () => {
    const p = card('nohit', 20);
    expect(punchTick(p, 12, 48)).toBeNull();
    punchHit(p);
    expect(p.progress).toBe(0);
    expect(punchTick(p, 19.9, 28)).toBeNull();
    expect(punchTick(p, 0.2, 27.8)).toBe('done');
    expect(p.status).toBe('done');
    punchHit(p);
    expect(p.progress).toBe(20); // a done card does not reset
  });

  it('no-hit fails once the clock cannot fit the streak any more, and never on an aisle without a clock', () => {
    const q = card('nohit', 20);
    expect(punchTick(q, 6, 25)).toBeNull();
    punchHit(q);
    expect(punchTick(q, 0.1, 24.9)).toBeNull(); // 25 s left still fits 20
    expect(punchTick(q, 0.1, 19.7)).toBe('failed'); // 0.2 s hit-free + 19.7 s left cannot reach 20
    expect(q.status).toBe('failed');
    const boss = card('nohit', 20);
    punchTick(boss, 5, -1); punchHit(boss);
    expect(punchTick(boss, 100, -1)).toBe('done');
  });

  it('the HUD view: whole seconds for the streak, a fraction for the bar', () => {
    const p = card('nohit', 20);
    punchTick(p, 12.7, 30);
    expect(punchView(p)).toMatchObject({ shown: 12, target: 20, status: 'active' });
    expect(punchView(p).frac).toBeCloseTo(0.635);
    const k = card('heat', 20); k.progress = 5;
    expect(punchView(k)).toMatchObject({ shown: 5, frac: 0.25 });
  });
});

describe('Punch Card reward', () => {
  const runWithCard = () => {
    const s = createRun(1);
    s.inventory.placed.push({ uid: newUid(s), type: 'punchcard', x: 3, y: 3, rot: 0 });
    s.punch = rollPunchCard(s.seed, s.inventory, { aisle: 1, boss: false, total: 30, fight: true })!;
    return s;
  };

  it('a completed card pays its coins on the receipt and gives the next shop one free reroll', () => {
    const s = runWithCard();
    s.punch!.status = 'done';
    const money = s.money;
    payPunchCard(s);
    expect(s.money).toBe(money + 5);
    expect(s.coinLog.find((c) => c.label === 'Punch Card')?.amount).toBe(5);
    finishWave(s);
    openShop(s, mulberry32(1));
    expect(s.shop!.bonusFreeRerolls).toBe(1);
    expect(s.punch).toBeUndefined();
  });

  it('a card left active or failed pays nothing', () => {
    for (const status of ['active', 'failed'] as const) {
      const s = runWithCard();
      s.punch!.status = status;
      const money = s.money;
      payPunchCard(s);
      expect(s.money).toBe(money);
      finishWave(s);
      openShop(s, mulberry32(1));
      expect(s.shop!.bonusFreeRerolls).toBe(0);
    }
  });
});
