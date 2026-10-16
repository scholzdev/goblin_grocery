import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER, TIER } from '../../../src/data/items';
import expiredmilk from '../../../src/content/items/expiredmilk';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: the cart poisons enemies within 110 for 3 dps (x TIER.mult) every 0.5 s (1 s of poison each time); max HP x0.9, rounded once.
describe('Expired Milk: build fields', () => {
  it('sets stinkDps to 3 / 4.5 / 6 at ★1 / ★2 / ★3, 0 without the item', () => {
    expect(full([at('toaster')]).stinkDps).toBe(0);
    expect([1, 2, 3].map((t) => full([at('toaster'), far('expiredmilk', t)]).stinkDps)).toEqual([3, 4.5, 6]);
  });

  it('matches the legacy formula 3 x TIER.mult to the bit, also at Gold Star\'s effective ★4 (7.5)', () => {
    for (const t of [1, 2, 3]) expect(full([at('toaster'), far('expiredmilk', t)]).stinkDps).toBe(3 * TIER.mult(t));
    expect(full([at('toaster'), corner('expiredmilk', 3), gilded(1)]).stinkDps).toBe(7.5);
  });

  it('multiplies the finished max HP by 0.9 and rounds once (the legacy Math.round(total x 0.9))', () => {
    expect(full([at('toaster'), far('expiredmilk')]).maxHp).toBe(Math.round(PLAYER.maxHp * 0.9)); // 36
    expect(full([at('toaster'), far('expiredmilk'), far('lunchbox', 2), far('snackbag')]).maxHp).toBe(Math.round((PLAYER.maxHp + 10 + 23 + 20) * 0.9)); // Snacks L2: +10
    expect(1 - contentTune('expiredmilk', 1).hpCut).toBe(0.9);
  });

  it('does not stack: the best copy counts once (aura and curse)', () => {
    const b = full([at('toaster'), far('expiredmilk', 1), far('expiredmilk', 3)]);
    expect(b.stinkDps).toBe(6);
    expect(b.maxHp).toBe(Math.round(PLAYER.maxHp * 0.9));
  });

  it('changes nothing but stinkDps and maxHp', () => {
    const plain = full([at('toaster')]), withMilk = full([at('toaster'), far('expiredmilk', 3)]);
    expect(withMilk.weapons).toEqual(plain.weapons);
    expect({ ...withMilk, stinkDps: 0, maxHp: 0, sets: plain.sets }).toEqual({ ...plain, stinkDps: 0, maxHp: 0 });
  });
});

// The aura is an `onTick` hook: a countdown in `c.state`, the first tick on the first frame, then every 0.5 s (no carry-over, like the old stinkT).
describe('Expired Milk: runtime', () => {
  /** The scene's old timer, as a model: counts down while active, fires at <= 0 and restarts at the interval. */
  const model = (dts: number[], interval = 0.5) => { let t = 0; return dts.map((dt) => (t -= dt) <= 0 && ((t = interval), true)); };

  it('poisons everything within 110 + its radius on the first frame, with 3 dps for 1 s at ★1', () => {
    const { fake } = arena([at('toaster'), far('expiredmilk')]);
    fake.player.x = 100; fake.player.y = 100;
    const near = fake.spawnEnemy({ x: 150, y: 100 }), edge = fake.spawnEnemy({ x: 100 + 110 + 20, y: 100 }), far_ = fake.spawnEnemy({ x: 100 + 110 + 21, y: 100 });
    fake.tick(0.016);
    expect(fake.callsOf('poison').map((c) => [c.enemy, c.dps, c.duration])).toEqual([[near.id, 3, 1], [edge.id, 3, 1]]);
    expect(far_.status.poisonDps).toBe(0);
    expect(near.status.poisonDps).toBe(3);
  });

  it('ticks on the old timer: every 0.5 s with no carry-over (60 fps frames and a few long frames)', () => {
    const { fake } = arena([at('toaster'), far('expiredmilk')]);
    fake.spawnEnemy({ x: 10, y: 0 });
    const dts = [...Array(80).fill(1 / 60), 0.05, 0.05, ...Array(40).fill(1 / 30), 0.3, 0.3];
    const want = model(dts);
    dts.forEach((dt, i) => {
      const before = fake.callsOf('poison').length;
      fake.tick(dt);
      expect(fake.callsOf('poison').length - before, `frame ${i}`).toBe(want[i] ? 1 : 0);
    });
    expect(want.filter(Boolean).length).toBeGreaterThan(3);
  });

  it('scales the dps with the tier (3 / 4.5 / 6, ★4: 7.5)', () => {
    for (const [tier, dps] of [[1, 3], [2, 4.5], [3, 6]] as const) {
      const { fake } = arena([at('toaster'), far('expiredmilk', tier)]);
      fake.spawnEnemy({ x: 10, y: 0 });
      fake.tick(0.016);
      expect(fake.callsOf('poison')[0].dps).toBe(dps);
    }
    const { fake } = arena([at('toaster'), corner('expiredmilk', 3), gilded(1)]);
    fake.spawnEnemy({ x: 10, y: 0 });
    fake.tick(0.016);
    expect(fake.callsOf('poison')[0].dps).toBe(7.5);
  });

  it('skips dead enemies, enemies still spawning in, and does nothing while the goblin is down (the timer does not run either)', () => {
    const { fake } = arena([at('toaster'), far('expiredmilk')]);
    const dead = fake.spawnEnemy({ x: 10, y: 0 }); dead.alive = false;
    fake.spawnEnemy({ x: 20, y: 0, state: 'spawn' });
    const live = fake.spawnEnemy({ x: 30, y: 0 });
    fake.player.dead = true;
    for (let i = 0; i < 90; i++) fake.tick(1 / 60);
    expect(fake.callsOf('poison')).toEqual([]);
    fake.player.dead = false;
    fake.tick(1 / 60); // the first frame back fires at once: the countdown never moved
    expect(fake.callsOf('poison').map((c) => c.enemy)).toEqual([live.id]);
  });

  it('is one aura however many copies: the best copy counts once', () => {
    const { fake } = arena([at('toaster'), far('expiredmilk', 1), far('expiredmilk', 3)]);
    fake.spawnEnemy({ x: 10, y: 0 });
    fake.tick(0.016);
    expect(fake.callsOf('poison').map((c) => c.dps)).toEqual([6]);
  });

  it('draws no random numbers', () => {
    const { fake } = arena([at('toaster'), far('expiredmilk')], { seed: 3 });
    fake.spawnEnemy({ x: 10, y: 0 });
    for (let i = 0; i < 100; i++) fake.tick(1 / 60);
    expect(fake.rng()).toBe(arena([at('toaster')], { seed: 3 }).fake.rng());
  });

  it('does nothing without the item', () => {
    const { fake } = arena([at('toaster')]);
    fake.spawnEnemy({ x: 10, y: 0 });
    for (let i = 0; i < 60; i++) fake.tick(1 / 60);
    expect(fake.calls).toEqual([]);
  });
});

describe('Expired Milk: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('expiredmilk')).toBe(expiredmilk);
    expect(ITEMS.expiredmilk).toMatchObject({ id: 'expiredmilk', family: 'snacks', name: 'Expired Milk', kind: 'passive', price: 7, electrical: false });
    expect(ITEMS.expiredmilk.cells).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
    expect(ITEMS.expiredmilk.rules).toBe('Cursed: poisons enemies within 110 of the cart: {0} poison damage (refreshes every 0.5 s, does not stack). Your max HP is reduced by 10%. Combo: Sour Mist with Spray Bottle + Desk Fan.');
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('expiredmilk', t).dps)).toEqual([3, 4.5, 6, 7.5]);
    expect(contentTune('expiredmilk', 1)).toMatchObject({ radius: 110, interval: 0.5, duration: 1, hpCut: 0.1 });
  });

  it('keeps its position in the item order', () => {
    expect(around('expiredmilk', 1, 1)).toEqual(['piggy', 'expiredmilk', 'tinfoilhat']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect(itemRules('expiredmilk', 2)).toBe('Cursed: poisons enemies within 110 of the cart: 4.5/s poison damage (refreshes every 0.5 s, does not stack). Your max HP is reduced by 10%. Combo: Sour Mist with Spray Bottle + Desk Fan.');
    setLang('de');
    expect(itemRules('expiredmilk', 2)).toBe('Verflucht: vergiftet Gegner im Umkreis von 110 um den Wagen: 4,5/s Giftschaden (erneuert sich alle 0,5 s, stapelt sich nicht). Deine max. LP sinken um 10%. Combo: Sauernebel mit Sprühflasche + Tischventilator.');
    expect(itemT('expiredmilk')).toMatchObject({ name: 'Abgelaufene Milch', blurb: 'Verflucht. Riecht nach einer schlechten Entscheidung.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('expiredmilk')).toEqual([{ label: 'Poison', values: ['3/s', '4.5/s', '6/s'] }]);
    setLang('de');
    expect(tierScaling('expiredmilk')).toEqual([{ label: 'Gift', values: ['3/s', '4,5/s', '6/s'] }]);
  });
});
