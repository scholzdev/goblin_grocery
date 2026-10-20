import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setLang } from '../src/i18n/lang';
import { buyOffer, createRun, openShop, recomputeBuild } from '../src/state/run';
import { mulberry32 } from '../src/systems/rng';
import type { RunState } from '../src/types';
import { build } from './golden/carts';
import { at, far } from './content/helpers';

// The shop receipt's "Interest next aisle" line, under the wallet: what the next aisle's end pays at the current money, and the cap.

let interestLineHtml: (s: RunState) => string;
beforeAll(async () => {
  // ui/shop.ts reads `location` at import time (via lab.ts); there is no DOM in the node test env.
  vi.stubGlobal('location', { search: '' });
  interestLineHtml = (await import('../src/ui/shop')).interestLineHtml;
});
afterEach(() => setLang('en'));
afterAll(() => vi.unstubAllGlobals());

const run = (money: number): RunState => {
  const s = createRun(1);
  s.money = money;
  return s;
};

describe('shop receipt: interest next aisle', () => {
  it('shows the coins the next aisle pays (after its 12-coin clear bonus) and the cap', () => {
    expect(interestLineHtml(run(35))).toMatch(/Interest next aisle.*\+3 \(max 3\)/s);
    expect(interestLineHtml(run(8))).toMatch(/Interest next aisle.*\+2 \(max 3\)/s);
    expect(interestLineHtml(run(0))).toMatch(/Interest next aisle.*\+1 \(max 3\)/s);
  });

  it('drops when the player spends below a step', () => {
    const s = run(0);
    openShop(s, mulberry32(1));
    const offer = s.shop!.offers.find((o) => o.price >= 10);
    expect(offer, 'an offer of 10+ coins').toBeDefined();
    s.money = offer!.price + 8;
    expect(interestLineHtml(s), 'before buying').toContain('+3 (max 3)');
    expect(buyOffer(s, offer!.slot).ok).toBe(true);
    expect(s.money).toBe(8);
    expect(interestLineHtml(s), 'after buying').toContain('+2 (max 3)');
  });

  it('shows the higher cap of Checkout L2', () => {
    const s = run(80);
    s.inventory = build([at('pan'), far('bell'), far('flag'), far('tipjar')], 8, 6);
    recomputeBuild(s);
    expect(interestLineHtml(s)).toContain('+6 (max 6)');
  });

  it('reads in German', () => {
    setLang('de');
    expect(interestLineHtml(run(35))).toMatch(/Zinsen nächster Gang.*\+3 \(max\. 3\)/s);
  });
});
