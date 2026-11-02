import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SET_THRESHOLDS } from '../src/engine/define';
import { setLang, t } from '../src/i18n';
import { createRun } from '../src/state/run';
import { settings } from '../src/state/settings';
import { store } from '../src/state/store';
import { computeBuild } from '../src/systems/synergies';
import type { Inventory, ShopOffer } from '../src/types';
import { build } from './golden/carts';

let shop: typeof import('../src/ui/shop');
let disclosure: typeof import('../src/state/disclosure');
beforeAll(async () => {
  vi.stubGlobal('location', { search: '' }); // ui/shop.ts reads `location` at import time
  shop = await import('../src/ui/shop');
  disclosure = await import('../src/state/disclosure');
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { settings.tutorialSeen = []; });

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const offer = (o: Partial<ShopOffer> & Pick<ShopOffer, 'type'>): ShopOffer => ({ slot: 0, tier: 1, price: 10, sold: false, ...o });
const runWith = (inv: Inventory) => {
  const s = createRun(1);
  s.inventory = inv;
  s.build = computeBuild(inv);
  store.state = s;
  return s;
};
const setsVisible = () => ({
  panel: text(shop.setsHtml()).includes('Kitchen'),
  inspector: text(shop.inspectorHtml('sample', null, offer({ type: 'sample' }))).includes('Kitchen'),
});

describe('disclosure: sets', () => {
  it('a fresh profile\'s first shop has no set panel and no set chips', () => {
    runWith(build([{ type: 'toaster' }]));
    expect(setsVisible()).toEqual({ panel: false, inspector: false });
  });

  it('after a run with two items of one set in the cart, the next shop shows them', () => {
    const first = runWith(build([{ type: 'toaster' }, { type: 'sample' }]));
    expect(setsVisible(), 'shown the moment the set is active').toEqual({ panel: true, inspector: true });
    expect(disclosure.disclose(first)).toEqual(['sets']);
    runWith(build([{ type: 'toaster' }]));
    expect(setsVisible(), 'next run, one Kitchen item').toEqual({ panel: true, inspector: true });
  });

  it('"Show all systems" shows them right away', () => {
    runWith(build([{ type: 'toaster' }]));
    expect(disclosure.allSystemsShown()).toBe(false);
    disclosure.showAllSystems();
    expect(setsVisible()).toEqual({ panel: true, inspector: true });
    expect(disclosure.allSystemsShown()).toBe(true);
  });

  it('the Test Lab and sims show sets and never record a system', () => {
    const s = runWith(build([{ type: 'toaster' }, { type: 'sample' }]));
    s.lab = true;
    s.stats.damage.reactions.shatter = 1;
    expect(disclosure.disclose(s)).toEqual([]);
    runWith(build([{ type: 'toaster' }])).lab = true;
    expect(setsVisible()).toEqual({ panel: true, inspector: true });
    store.state.lab = false;
    expect(setsVisible(), 'a normal run of the same profile').toEqual({ panel: false, inspector: false });
  });

  it('the set tip names the set thresholds, in EN and DE', () => {
    const [a, b, c] = SET_THRESHOLDS;
    expect(t('tipSets')).toContain(`${a}, ${b} and ${c} points`);
    setLang('de');
    expect(t('tipSets')).toContain(`${a}, ${b} und ${c} Punkte`);
    setLang('en');
  });
});

describe('disclosure: reactions', () => {
  it('each reaction is announced the first time it fires for the profile, never again', () => {
    const s = runWith(build([{ type: 'toaster' }]));
    expect(disclosure.disclose(s)).toEqual([]);
    s.stats.damage.reactions.shatter = 1;
    expect(disclosure.disclose(s)).toEqual(['shatter']);
    s.stats.damage.reactions.shatter = 2;
    expect(disclosure.disclose(s), 'same run').toEqual([]);
    const next = runWith(build([{ type: 'toaster' }]));
    next.stats.damage.reactions.shatter = 1;
    next.stats.damage.reactions.fumes = 1;
    expect(disclosure.disclose(next), 'next run').toEqual(['fumes']);
  });

  it('the banner names the reaction and says what it does, in EN and DE', async () => {
    const { REACTION_TEXT } = await import('../src/engine/reactions');
    const { t, setLang } = await import('../src/i18n');
    const banner = () => [t(REACTION_TEXT.shatter.name), t(REACTION_TEXT.shatter.desc)];
    expect(banner()).toEqual(['Shatter', 'Burn + frost: a burst of extra damage on the enemy.']);
    setLang('de');
    expect(banner()).toEqual(['Splitter', 'Brand + Frost: ein Stoß Zusatzschaden auf den Gegner.']);
    setLang('en');
  });
});

describe('disclosure: profiles from before', () => {
  const storage = (data: Record<string, unknown>) => {
    const m = new Map(Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)]));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  const load = async (data: Record<string, unknown>) => {
    vi.resetModules();
    vi.stubGlobal('localStorage', storage(data));
    return import('../src/state/disclosure');
  };
  const veteran = { v: 1, stats: { runs: 4 } };

  it('a profile with finished runs from before sees every system', async () => {
    expect((await load({ 'goblin-grocery.profile.v1': veteran })).allSystemsShown()).toBe(true);
  });

  it('a profile that started fresh keeps meeting them after its first runs', async () => {
    const d = await load({ 'goblin-grocery.profile.v1': veteran, 'goblin-grocery.settings.v1': { tutorialSeen: ['sys', 'move'] } });
    expect(d.introduced('sets')).toBe(false);
  });
});
