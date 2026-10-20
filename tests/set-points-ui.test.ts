import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { setLang } from '../src/i18n';
import { createRun } from '../src/state/run';
import { store } from '../src/state/store';
import { computeBuild } from '../src/systems/synergies';
import type { ShopOffer } from '../src/types';
import { build } from './golden/carts';

let shop: typeof import('../src/ui/shop');
beforeAll(async () => {
  vi.stubGlobal('location', { search: '' }); // ui/shop.ts reads `location` at import time
  shop = await import('../src/ui/shop');
});
afterAll(() => { setLang('en'); vi.unstubAllGlobals(); });

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const offer = (o: Partial<ShopOffer> & Pick<ShopOffer, 'type'>): ShopOffer => ({ slot: 0, tier: 1, price: 10, sold: false, ...o });
const runWith = (inv = build([{ type: 'toaster' }])) => {
  const s = createRun(1);
  s.inventory = inv;
  s.build = computeBuild(inv);
  store.state = s;
  return s;
};

describe('shop UI: set points', () => {
  it('the inspector shows how many set points an offer adds per set when it is more than 1', () => {
    runWith();
    expect(text(shop.inspectorHtml('ice', null, offer({ type: 'ice', tier: 2 })))).toMatch(/Kitchen \+2 .*Frost \+2/);
    expect(text(shop.inspectorHtml('ice', null, offer({ type: 'ice', tier: 2, double: true })))).toMatch(/Kitchen \+3 .*Frost \+3/);
    expect(text(shop.inspectorHtml('ice', null, offer({ type: 'ice' }))), 'a ★1 copy counts 1: no number').not.toMatch(/Kitchen \+\d/);
  });

  it('the inspector shows a placed item\'s points with its Gold Star lift', () => {
    const s = runWith(build([{ type: 'fan', tier: 3 }, { type: 'goldstar' }], 5, 4));
    expect(text(shop.inspectorHtml('fan', s.inventory.placed[0].uid))).toContain('Cleaning +4');
  });

  it('the receipt preview counts the offer\'s tier', () => {
    runWith(build([{ type: 'toaster' }, { type: 'sample', near: [] }]));
    const html = shop.setsHtml(offer({ type: 'hotsauce', tier: 2 }));
    expect(text(html)).toContain('Kitchen 2→4');
    const pips = html.match(/<span class="pips set-kitchen">(.*?)<\/span>/)![1];
    expect([pips.match(/"on"/g)?.length, pips.match(/"ghost"/g)?.length], 'two points held, two more ghosted').toEqual([2, 2]);
  });

  it('the double-pack note says what it adds, in EN and DE', () => {
    runWith();
    expect(text(shop.inspectorHtml('ice', null, offer({ type: 'ice', double: true })))).toContain('Double pack: +1 set point per set');
    setLang('de');
    expect(text(shop.inspectorHtml('ice', null, offer({ type: 'ice', double: true })))).toContain('Doppelpack: +1 Setpunkt pro Set');
    setLang('en');
  });
});
