import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import tinfoilhat from '../../../src/content/items/tinfoilhat';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, corner, far, gilded } from '../helpers';

afterEach(() => setLang('en'));

const scenes = import.meta.glob('../../../src/scenes/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const source = (file: string): string => Object.entries(scenes).find(([k]) => k.endsWith(`/${file}`))![1];

// The reflect is an `onEnemyShotTouch` hook; the dash window (`player.reflectT`) is kept by onDashStart + onTick, with the frame semantics of the
// old line in updatePlayer: `if (shoveT > 0) reflectT = grace; else reflectT -= dt`, evaluated at the start of the frame.
describe('Tin Foil Hat: runtime', () => {
  const touch = (fake: ReturnType<typeof arena>['fake'], damage = 8) => {
    const shot = fake.spawnHostileShot({ damage });
    const ev = { shot, damage, handled: false };
    fake.hooks.emit('onEnemyShotTouch', ev);
    return { shot, ev };
  };

  it('turns a touching shot around while reflectT is open: reflectShot with the tier multiplier, and the shot is handled', () => {
    for (const [tier, mult] of [[1, 1.5], [2, 2.25], [3, 3]] as const) {
      const { fake } = arena([at('toaster'), far('tinfoilhat', tier)]);
      fake.player.reflectT = 0.05;
      const { shot, ev } = touch(fake);
      expect(ev.handled).toBe(true);
      expect(fake.callsOf('reflectShot')).toEqual([{ at: 0, kind: 'reflectShot', shot, mult }]);
    }
  });

  it('lets the shot through (not handled, nothing reflected) when the window is closed, at 0 and below', () => {
    const { fake } = arena([at('toaster'), far('tinfoilhat', 3)]);
    for (const reflectT of [0, -0.3]) {
      fake.player.reflectT = reflectT;
      const { ev } = touch(fake);
      expect(ev.handled).toBe(false);
    }
    expect(fake.callsOf('reflectShot')).toEqual([]);
  });

  it('Gold Star\'s effective ★4 reflects 3.75x, two copies the best one', () => {
    const lifted = arena([at('toaster'), corner('tinfoilhat', 3), gilded(1)]);
    lifted.fake.player.reflectT = 0.1;
    touch(lifted.fake);
    expect(lifted.fake.callsOf('reflectShot')[0].mult).toBe(3.75);
    const two = arena([at('toaster'), far('tinfoilhat', 1), far('tinfoilhat', 2)]);
    two.fake.player.reflectT = 0.1;
    touch(two.fake);
    expect(two.fake.callsOf('reflectShot').map((c) => c.mult)).toEqual([2.25]);
  });

  it('does nothing without the item: the shot is not handled', () => {
    const { fake } = arena([at('toaster')]);
    fake.player.reflectT = 0.1;
    const { ev } = touch(fake);
    expect(ev.handled).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  /**
   * The old scene logic as a model, one frame at a time. `start` = a dash begins this frame. Order inside the scene's frame: updatePlayer
   * (dash start + `reflectT` line at the top of the dash block + `shoveT -= dt` and the wall check), then the onTick emit.
   */
  const drive = (frames: { dt: number; start?: boolean; wall?: boolean }[]) => {
    const { fake } = arena([at('toaster'), far('tinfoilhat')]);
    const p = fake.player;
    let modelT = 0;
    frames.forEach(({ dt, start, wall }, i) => {
      if (start) { p.shoveT = 0.16; fake.hooks.emit('onDashStart', { x: 0, y: 0, dx: 1, dy: 0, reach: 130, chained: false }); }
      if (p.shoveT > 0) modelT = 0.1; else modelT -= dt; // the removed line of updatePlayer
      if (p.shoveT > 0) { p.shoveT -= dt; if (wall) p.shoveT = 0; }
      fake.tick(dt);
      expect(p.reflectT, `frame ${i}`).toBeCloseTo(modelT, 12);
      expect(p.reflectT > 0, `frame ${i} open`).toBe(modelT > 0);
    });
    return p;
  };

  it('keeps reflectT at the grace (0.1 s) through the dash, including the last frame, then counts it down: same as the old line', () => {
    const dt = 1 / 60;
    drive([{ dt, start: true }, ...Array(12).fill({ dt }), ...Array(10).fill({ dt })]);
  });

  it('matches the old line with uneven frames, a wall stop and a second dash right after the first', () => {
    drive([
      { dt: 0.016, start: true }, { dt: 0.05 }, { dt: 0.05 }, { dt: 0.05 }, { dt: 0.016 }, { dt: 0.016 }, { dt: 0.05 },
      { dt: 0.016, start: true, wall: true }, { dt: 0.016 }, { dt: 0.016 }, { dt: 0.016 }, { dt: 0.016 }, { dt: 0.016 }, { dt: 0.016 }, { dt: 0.016 },
      { dt: 0.03, start: true }, { dt: 0.03 }, { dt: 0.03 }, { dt: 0.03 }, { dt: 0.03 }, { dt: 0.03 },
    ]);
  });

  it('is closed outside a dash: after the grace ran out a shot hurts again', () => {
    const p = drive([{ dt: 0.016, start: true }, ...Array(20).fill({ dt: 0.016 })]);
    expect(p.reflectT).toBeLessThanOrEqual(0);
  });

  it('a shot that arrives mid-dash and one just after the dash (inside the grace) are reflected; one 0.2 s later is not', () => {
    const { fake } = arena([at('toaster'), far('tinfoilhat')]);
    const p = fake.player;
    p.shoveT = 0.16;
    fake.hooks.emit('onDashStart', { x: 0, y: 0, dx: 1, dy: 0, reach: 130, chained: false });
    fake.tick(0.05);
    p.shoveT -= 0.05;
    expect(touch(fake).ev.handled).toBe(true);
    p.shoveT = 0; // dash over this frame
    fake.tick(0.016);
    expect(touch(fake).ev.handled).toBe(true);
    for (let i = 0; i < 4; i++) fake.tick(0.05);
    expect(touch(fake).ev.handled).toBe(false);
  });
});

// Guards for the scene side: the dash code no longer owns reflectT, and the legacy reflect branch in weapons.ts is gone.
describe('Tin Foil Hat: the legacy reads are gone', () => {
  it('ArenaScene does not write reflectT; weapons.ts has no reflectMult branch and Arsenal.reflect needs its multiplier', () => {
    expect(source('ArenaScene.ts')).not.toMatch(/reflectT\s*(=|-=)/);
    expect(source('ArenaScene.ts')).not.toContain('TINFOIL');
    expect(source('weapons.ts')).not.toContain('reflectMult');
    expect(source('weapons.ts')).toContain('reflect(s: Shot, mult: number)');
  });

  it('the hook sits before the generic hurt call in updateEnemyShots (handled shots are skipped)', () => {
    const w = source('weapons.ts');
    const body = w.slice(w.indexOf('private updateEnemyShots'));
    expect(body.indexOf("emit('onEnemyShotTouch'")).toBeGreaterThan(-1);
    expect(body.indexOf('if (ev.handled) continue')).toBeLessThan(body.indexOf('sc.hurtPlayer(s.damage)'));
  });
});

describe('Tin Foil Hat: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('tinfoilhat')).toBe(tinfoilhat);
    expect(ITEMS.tinfoilhat).toMatchObject({ id: 'tinfoilhat', family: 'tools', kind: 'passive', price: 9, electrical: false });
    expect(ITEMS.tinfoilhat.element).toBeUndefined();
    expect(ITEMS.tinfoilhat.cells).toEqual([{ x: 0, y: 0 }]);
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('tinfoilhat', t).mult)).toEqual([1.5, 2.25, 3, 3.75]);
    expect(contentTune('tinfoilhat', 1).grace).toBe(0.1);
  });

  it('keeps its position in the item order', () => {
    expect(around('tinfoilhat', 1, 1)).toEqual(['expiredmilk', 'tinfoilhat', 'jellybeans']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect(itemRules('tinfoilhat', 2)).toBe('While dashing (and 0.1 s after), enemy shots that touch you are reflected back at the groceries for 2.25× of their damage instead of hurting you. Combos: Sparks Fly with Microwave + Battery; Ray Gun with Nail Gun + Battery + Magnet.');
    setLang('de');
    expect(itemRules('tinfoilhat', 3)).toBe('Beim Dashen (und 0,1 s danach) werden Gegnerschüsse, die dich berühren, mit 3× ihres Schadens auf die Gegner zurückgeworfen, statt dich zu treffen. Combos: Funkenflug mit Mikrowelle + Batterie; Strahlenkanone mit Nagelpistole + Batterie + Magnet.');
    expect(itemT('tinfoilhat')).toMatchObject({ name: 'Aluhut', blurb: 'Blockt das Signal. Und die Limo.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('tinfoilhat')).toEqual([{ label: 'Reflected damage', values: ['1.5×', '2.25×', '3×'] }]);
    setLang('de');
    expect(tierScaling('tinfoilhat')).toEqual([{ label: 'Reflektierter Schaden', values: ['1,5×', '2,25×', '3×'] }]);
  });
});
