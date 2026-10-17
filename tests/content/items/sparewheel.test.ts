import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import sparewheel from '../../../src/content/items/sparewheel';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, corner, far, gilded } from '../helpers';

afterEach(() => setLang('en'));

const arenaSource = (Object.values(import.meta.glob('../../../src/scenes/ArenaScene.ts', { query: '?raw', import: 'default', eager: true }))[0] as string);

// The window is an `onDashStart` hook: the scene resets chainT to 0 on every dash and emits; a normal dash opens the window again.
describe('Spare Wheel: runtime', () => {
  const dash = (fake: ReturnType<typeof arena>['fake'], chained: boolean) => {
    fake.player.chainT = 0; // what the scene does before the emit
    fake.hooks.emit('onDashStart', { x: 0, y: 0, dx: 1, dy: 0, reach: 130, chained });
  };

  it('a normal dash opens the free window: chainT = 1 / 1.5 / 2 s', () => {
    for (const [tier, window] of [[1, 1], [2, 1.5], [3, 2]] as const) {
      const { fake } = arena([at('toaster'), far('sparewheel', tier)]);
      dash(fake, false);
      expect(fake.player.chainT).toBe(window);
    }
  });

  it('a chained dash uses the window up and does not open another (the chain is one free dash long)', () => {
    const { fake } = arena([at('toaster'), far('sparewheel', 3)]);
    dash(fake, false);
    expect(fake.player.chainT).toBe(2);
    dash(fake, true);
    expect(fake.player.chainT).toBe(0);
  });

  it('a normal dash closes a still-open old window and opens a fresh one (chainT is reset, then set)', () => {
    const { fake } = arena([at('toaster'), far('sparewheel', 1)]);
    fake.player.chainT = 0.4; // the cooldown ran out before the window did
    fake.hooks.emit('onDashStart', { x: 0, y: 0, dx: 1, dy: 0, reach: 130, chained: false }); // scene had reset it to 0 first; the hook then sets the full window
    expect(fake.player.chainT).toBe(1);
  });

  it('Gold Star\'s effective ★4 gives 2.5 s, two copies the best one', () => {
    const lifted = arena([at('toaster'), corner('sparewheel', 3), gilded(1)]);
    dash(lifted.fake, false);
    expect(lifted.fake.player.chainT).toBe(2.5);
    const two = arena([at('toaster'), far('sparewheel', 1), far('sparewheel', 2)]);
    dash(two.fake, false);
    expect(two.fake.player.chainT).toBe(1.5);
  });

  it('does nothing without the item (the dash stays plain: chainT 0, no calls)', () => {
    const { fake } = arena([at('toaster')]);
    dash(fake, false);
    expect(fake.player.chainT).toBe(0);
    expect(fake.calls).toEqual([]);
  });

  // Guard for the scene side: the reset must come before the emit, and the build field is not read there any more.
  it('the scene resets chainT, then emits onDashStart; it no longer reads build.dashChain', () => {
    const reset = arenaSource.indexOf('p.chainT = 0;'), emit = arenaSource.indexOf("this.hooks.emit('onDashStart'");
    expect(reset).toBeGreaterThan(-1);
    expect(emit).toBeGreaterThan(reset);
    expect(arenaSource).not.toContain('build.dashChain');
  });
});

describe('Spare Wheel: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('sparewheel')).toBe(sparewheel);
    expect(ITEMS.sparewheel).toMatchObject({ id: 'sparewheel', family: 'tools', kind: 'passive', price: 10, electrical: false });
    expect(ITEMS.sparewheel.element).toBeUndefined();
    expect(ITEMS.sparewheel.cells).toEqual([{ x: 0, y: 0 }]);
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('sparewheel', t).window)).toEqual([1, 1.5, 2, 2.5]);
  });

  it('keeps its position in the item order', () => {
    expect(around('sparewheel', 1, 1)).toEqual(['bumper', 'sparewheel', 'tipjar']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('sparewheel', t))).toEqual([
      'After a dash, one more dash within 1 s is free: it skips the cooldown (does not stack).',
      'After a dash, one more dash within 1.5 s is free: it skips the cooldown (does not stack).',
      'After a dash, one more dash within 2 s is free: it skips the cooldown (does not stack).',
    ]);
    setLang('de');
    expect(itemRules('sparewheel', 2)).toBe('Nach einem Dash ist ein weiterer Dash innerhalb von 1,5 s gratis: er überspringt die Abklingzeit (stapelt sich nicht).');
    expect(itemT('sparewheel')).toMatchObject({ name: 'Ersatzrad', blurb: 'Zwei Dashes zum Preis von einem.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('sparewheel')).toEqual([{ label: 'Free dash window', values: ['1 s', '1.5 s', '2 s'] }]);
    setLang('de');
    expect(tierScaling('sparewheel')).toEqual([{ label: 'Gratis-Dash-Fenster', values: ['1 s', '1,5 s', '2 s'] }]);
  });
});
