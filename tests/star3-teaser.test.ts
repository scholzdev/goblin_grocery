import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { setLang } from '../src/i18n';
import { itemRules, star3Teaser } from '../src/i18n/data';
import { createRun } from '../src/state/run';
import { store } from '../src/state/store';
import type { ShopOffer } from '../src/types';

let shop: typeof import('../src/ui/shop');
beforeAll(async () => {
  vi.stubGlobal('location', { search: '' }); // ui/shop.ts reads `location` at import time
  shop = await import('../src/ui/shop');
  store.state = createRun(1);
});
afterAll(() => { setLang('en'); vi.unstubAllGlobals(); });

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const offer = (type: ShopOffer['type'], tier: number): ShopOffer => ({ slot: 0, type, tier, price: 10, sold: false });

describe('★3 teaser', () => {
  it('★1 and ★2 weapons show what ★3 adds; at ★3 the rules already say it', () => {
    for (const tier of [1, 2]) expect(text(shop.inspectorHtml('toaster', null, offer('toaster', tier)))).toContain('At ★3: Also fires a toast at a second enemy.');
    const at3 = text(shop.inspectorHtml('toaster', null, offer('toaster', 3)));
    expect(at3).not.toContain('At ★3');
    expect(at3).toContain('★3: Also fires a toast at a second enemy.');
  });

  it('the teaser is the ★3 line itemRules adds at ★3, with the ★3 numbers', () => {
    const teaser = star3Teaser('cooker', 1);
    expect(teaser).toMatch(/^At ★3: /);
    expect(itemRules('cooker', 3)).toContain(teaser.replace('At ★3: ', '★3: '));
  });

  it('says "Bei ★3:" in German', () => {
    setLang('de');
    expect(star3Teaser('toaster', 2)).toBe('Bei ★3: Feuert zusätzlich einen Toast auf einen zweiten Gegner.');
    setLang('en');
  });

  it('items without a ★3 line get none', () => {
    expect([star3Teaser('laser', 1), star3Teaser('sample', 1)]).toEqual(['', '']);
  });
});
