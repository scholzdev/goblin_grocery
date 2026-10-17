import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER, TIER } from '../../../src/data/items';
import bell from '../../../src/content/items/bell';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

const BASE = PLAYER.shove.cooldown; // 3 s
const NIGHT = PLAYER.starters.night.perk!; // shoveCooldown -1, moveSpeedMult 1.08, damageMult 0.9

// Legacy: dash (shove) cooldown -0.5 s at ★1 x TIER.mult; the cart-wide best copy counts. The perk's shoveCooldown (Night Shift) is added on top.
describe('Shopping Bell: build', () => {
  it('cuts the dash cooldown by 0.5 / 0.75 / 1 s at ★1 / ★2 / ★3', () => {
    expect(full([at('toaster')]).shoveCooldown).toBe(BASE);
    expect([1, 2, 3].map((t) => full([at('toaster'), far('bell', t)]).shoveCooldown)).toEqual([2.5, 2.25, 2]);
  });

  it('changes nothing but the dash cooldown', () => {
    const plain = full([at('toaster')]), withBell = full([at('toaster'), far('bell', 3)]);
    expect(withBell.weapons).toEqual(plain.weapons);
    expect({ ...withBell, shoveCooldown: 0 }).toEqual({ ...plain, shoveCooldown: 0 });
  });

  it('does not stack: the best copy in the whole cart counts once', () => {
    expect(full([at('toaster'), far('bell', 1), far('bell', 3)]).shoveCooldown).toBe(2);
    expect(full([at('toaster'), far('bell', 2), at('bell', 1, { near: [0] })]).shoveCooldown).toBe(2.25);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4: -1.25 s)', () => {
    expect(0.5 * TIER.mult(4)).toBe(1.25);
    expect(full([at('toaster'), corner('bell', 3), gilded(1)]).shoveCooldown).toBe(BASE - 1.25);
    expect(full([at('toaster'), corner('bell', 1), gilded(1)]).shoveCooldown).toBe(2.25); // ★1 -> effective ★2
  });

  it('adds to the Night Shift perk (-1 s) and a positive perk', () => {
    expect(full([at('toaster')], NIGHT).shoveCooldown).toBe(2);
    expect(full([at('toaster'), far('bell', 2)], NIGHT).shoveCooldown).toBe(BASE - 0.75 - 1);
    expect(full([at('toaster'), far('bell')], { shoveCooldown: 0.5 }).shoveCooldown).toBe(BASE - 0.5 + 0.5);
  });

  it('is independent of the tools set (its L2 stuns and doubles dash damage, but leaves the cooldown to the Bell)', () => {
    const tools = full([at('nailgun'), far('tape'), far('boot'), far('bell')], NIGHT); // nailgun + tape + boot = Tools L2
    expect(tools.sets.tools).toBe(2);
    expect(tools.shoveCooldown).toBe(BASE - 0.5 - 1);
    expect(tools.shoveCooldown).toBe(full([at('toaster'), far('bell')], NIGHT).shoveCooldown);
  });

  it('keeps Express Checkout (its combo with a Frying Pan) working', () => {
    const b = full([at('pan'), at('bell', 1, { near: [0] })]);
    expect(b.recipes.map((r) => r.id)).toEqual(['expressCheckout']);
    expect(b.shoveCooldown).toBe(2.5);
  });
});

describe('Shopping Bell: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('bell')).toBe(bell);
    expect(ITEMS.bell).toMatchObject({ id: 'bell', family: 'checkout', kind: 'passive', price: 7, electrical: false });
    expect(ITEMS.bell.element).toBeUndefined();
    expect(ITEMS.bell.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.bell.legendary).toBeUndefined();
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('bell', t).cooldown)).toEqual([0.5, 0.75, 1, 1.25]);
  });

  it('keeps its position in the item order', () => {
    expect(around('bell', 1, 1)).toEqual(['lunchbox', 'bell', 'boot']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('bell', t))).toEqual([
      'Dash cooldown −0.5 s (does not stack). Enables Express Checkout next to a Frying Pan.',
      'Dash cooldown −0.75 s (does not stack). Enables Express Checkout next to a Frying Pan.',
      'Dash cooldown −1 s (does not stack). Enables Express Checkout next to a Frying Pan.',
    ]);
    setLang('de');
    expect(itemRules('bell', 2)).toBe('Dash-Abklingzeit −0,75 s (stapelt sich nicht). Schaltet Schnellkasse neben einer Bratpfanne frei.');
    expect(itemT('bell')).toMatchObject({ name: 'Einkaufsklingel', blurb: 'Kling! Öfter dashen.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('bell')).toEqual([{ label: 'Dash cooldown', values: ['−0.5 s', '−0.75 s', '−1 s'] }]);
    setLang('de');
    expect(tierScaling('bell')).toEqual([{ label: 'Dash-Abklingzeit', values: ['−0,5 s', '−0,75 s', '−1 s'] }]);
  });
});
