import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import sparklers from '../../../src/content/items/sparklers';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemT } from '../../../src/i18n/data';
import { arena, at, far } from '../helpers';

// Sparklers: every Nth direct hit of an adjacent weapon sets off a popper blast (6 / 4 / 3 hits per ★), at most one per weapon per 0.5 s.
const run = (tier = 1, spec = at('sparklers', tier)) => {
  const a = arena([at('toaster'), spec]);
  const e = a.fake.spawnEnemy({ hp: 100000 });
  return { ...a, e, hit: (n = 1, opts = {}) => { for (let i = 0; i < n; i++) a.fake.hit(e, 1, a.stats, opts); } };
};

describe('Sparklers: content', () => {
  it('is the registered content file: a 1x1 Snacks/Blast module with no buff', () => {
    expect(contentItem('sparklers')).toBe(sparklers);
    expect(ITEMS.sparklers).toMatchObject({ id: 'sparklers', family: 'snacks', element: 'blast', kind: 'module', price: 9 });
    expect(ITEMS.sparklers.buff).toBeUndefined();
    expect([1, 2, 3].map((t) => contentTune('sparklers', t).every)).toEqual([6, 4, 3]);
    expect(itemT('sparklers')).toMatchObject({ name: 'Sparklers', blurb: 'Hold at arm\'s length. Or don\'t.' });
  });
});

describe('Sparklers: runtime', () => {
  it('blasts on every 6th direct hit at ★1 (6 damage, radius 50 x the Blast set\'s 1.15 with Sparklers + Toaster... Snacks/Blast set off)', () => {
    const a = run(1);
    a.hit(5);
    expect(a.fake.callsOf('popperBlast')).toHaveLength(0);
    a.hit();
    expect(a.fake.callsOf('popperBlast')).toMatchObject([{ x: a.e.x, y: a.e.y, damage: 6, radius: 50 }]);
  });

  it('★3 blasts every 3rd hit, and the count restarts after a blast', () => {
    const a = run(3);
    for (let i = 0; i < 6; i++) { a.hit(); a.fake.advance(1); }
    expect(a.fake.callsOf('popperBlast')).toHaveLength(2);
  });

  it('quiet and indirect hits do not count', () => {
    const a = run(3);
    for (const o of [{ quiet: true }, { isDot: true }, { echo: true }, { chained: true }, { fromPopper: true }]) a.hit(3, o);
    expect(a.fake.callsOf('popperBlast')).toHaveLength(0);
  });

  it('a module that does not touch the weapon does nothing', () => {
    const a = run(3, far('sparklers', 3));
    a.hit(9);
    expect(a.fake.callsOf('popperBlast')).toHaveLength(0);
  });

  it('at most one blast per weapon per 0.5 s: a due blast inside the gap is skipped', () => {
    const a = run(3);
    a.hit(3);
    a.hit(3);
    expect(a.fake.callsOf('popperBlast')).toHaveLength(1);
    a.fake.advance(0.5);
    a.hit(3);
    expect(a.fake.callsOf('popperBlast')).toHaveLength(2);
  });
});
