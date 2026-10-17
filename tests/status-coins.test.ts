import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/data/events';
import { MODIFIERS } from '../src/data/modifiers';
import { SHIFTS } from '../src/data/waves';
import { ENEMIES } from '../src/data/enemies';
import { FakeCtx } from '../src/engine/fakeCtx';
import { applyBurn, applyPoison, giftcardCoins, killCoinMult, newStatus, tickBurn, tickPoison } from '../src/systems/combat';
import { computeBuild } from '../src/systems/synergies';
import { cart } from './cart';

const burn = (dps: number, duration: number) => ({ dps, duration, tick: 0.5 });

describe('burn: a re-application never shortens a running burn', () => {
  it('a shorter re-application keeps the end time, a longer one extends it', () => {
    const s = newStatus();
    applyBurn(s, burn(2, 5), 0);
    expect(s.burnUntil).toBe(5);
    applyBurn(s, burn(2, 1), 1); // would end at 2: the running burn lasts until 5
    expect(s.burnUntil).toBe(5);
    applyBurn(s, burn(2, 3), 2); // ends at 5 as well
    expect(s.burnUntil).toBe(5);
    applyBurn(s, burn(2, 4), 3); // ends at 7: extends
    expect(s.burnUntil).toBe(7);
  });

  it('the dps is the maximum of the running and the new burn, in both orders', () => {
    const s = newStatus();
    applyBurn(s, burn(3, 4), 0);
    applyBurn(s, burn(1, 1), 1);
    expect(s.burnDps).toBe(3);
    applyBurn(s, burn(5, 1), 1.5);
    expect(s.burnDps).toBe(5);
    expect(s.burnUntil).toBe(4);
  });

  it('keeps ticking until the original end after a short re-application', () => {
    const s = newStatus();
    applyBurn(s, burn(2, 4), 0);
    let total = 0;
    for (let i = 1; i <= 100; i++) {
      const t = i / 10;
      total += tickBurn(s, t);
      if (i === 10) applyBurn(s, burn(2, 0.5), 1); // used to cut the burn short at 1.5
    }
    expect(total).toBeCloseTo(8); // 2 dps x 4 s
  });

  it('an expired burn starts fresh, at the new dps and duration', () => {
    const s = newStatus();
    applyBurn(s, burn(5, 1), 0);
    applyBurn(s, burn(2, 2), 10);
    expect(s.burnDps).toBe(2);
    expect(s.burnUntil).toBe(12);
    expect(s.nextBurnAt).toBe(10.5);
  });

  it('the ctx.ignite path (hits, puddles, chain burns) behaves the same', () => {
    const c = new FakeCtx();
    const e = c.spawnEnemy({ hp: 100 });
    c.ignite(e, burn(2, 5));
    c.advance(1);
    c.ignite(e, burn(2, 1));
    expect(e.status.burnUntil).toBe(5);
    c.advance(1);
    c.ignite(e, burn(2, 6));
    expect(e.status.burnUntil).toBe(8);
  });
});

describe('poison: a re-application never shortens a running poison', () => {
  it('a shorter re-application keeps the end time, a longer one extends it', () => {
    const s = newStatus();
    applyPoison(s, 4, 6, 0);
    applyPoison(s, 4, 1, 2); // would end at 3
    expect(s.poisonUntil).toBe(6);
    applyPoison(s, 4, 5, 3); // ends at 8
    expect(s.poisonUntil).toBe(8);
  });

  it('keeps the higher dps whichever comes first', () => {
    const s = newStatus();
    applyPoison(s, 2, 4, 0);
    applyPoison(s, 6, 1, 1);
    expect(s.poisonDps).toBe(6);
    applyPoison(s, 1, 1, 2);
    expect(s.poisonDps).toBe(6);
    expect(s.poisonUntil).toBe(4);
  });

  it('keeps ticking until the original end after a short re-application', () => {
    const s = newStatus();
    applyPoison(s, 2, 4, 0);
    let total = 0;
    for (let i = 1; i <= 100; i++) {
      const t = i / 10;
      total += tickPoison(s, t);
      if (i === 10) applyPoison(s, 2, 0.5, 1);
    }
    expect(total).toBeCloseTo(8);
  });

  it('the ctx.poison path (Sour Mist, Expired Milk) behaves the same', () => {
    const c = new FakeCtx();
    const e = c.spawnEnemy({ hp: 100 });
    c.poison(e, 1, 5);
    c.advance(2);
    c.poison(e, 1, 1);
    expect(e.status.poisonUntil).toBe(5);
    c.poison(e, 3, 6);
    expect(e.status.poisonUntil).toBe(8);
    expect(e.status.poisonDps).toBe(3);
  });
});

describe('Gift Card jackpot', () => {
  const plain = { dept: 1, modifier: 1, shift: 1, event: 1, kill: 1 };
  const jackpot = ENEMIES.giftcard.tune.coinMult;

  it('is 8x the card\'s coins, all dropped, with no event and no kill-coin items', () => {
    expect(jackpot).toBe(8);
    expect(giftcardCoins(ENEMIES.giftcard.coins, jackpot, plain)).toBe(16);
  });

  it('doubles under Flash Sale', () => {
    expect(EVENTS.flashSale.coinMult).toBe(2);
    expect(giftcardCoins(2, jackpot, { ...plain, event: EVENTS.flashSale.coinMult })).toBe(32);
  });

  it('follows the cart\'s kill-coin multiplier (Piggy Bank)', () => {
    const piggy = computeBuild(cart('toaster', ['piggy'])).killCoinMult;
    expect(piggy).toBeGreaterThan(1);
    expect(giftcardCoins(2, jackpot, { ...plain, kill: piggy })).toBe(Math.round(16 * piggy));
    expect(giftcardCoins(2, jackpot, { ...plain, kill: piggy })).toBeGreaterThan(giftcardCoins(2, jackpot, plain));
  });

  it('keeps the department, door modifier and shift multipliers it always had', () => {
    const shift = SHIFTS[2].coinMult, door = MODIFIERS.rush.coinMult;
    expect(giftcardCoins(2, jackpot, { dept: 1.25, modifier: door, shift, event: 1, kill: 1 })).toBe(Math.round(2 * 8 * 1.25 * door * shift));
  });

  it('uses the same product as the regular kill coins', () => {
    const m = { dept: 1.25, modifier: 1.1, shift: 0.9, event: 2, kill: 1.15 };
    expect(killCoinMult(m)).toBe(1.25 * 1.1 * 0.9 * 2 * 1.15);
    expect(giftcardCoins(2, 8, m)).toBe(Math.round(2 * 8 * killCoinMult(m)));
  });
});
