import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import sample from '../../../src/content/items/sample';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: every crit heals 1 HP at ★1 (x TIER.mult), at most 2 HP per whole second, the best copy in the cart counts once.
describe('Free Sample: build field', () => {
  it('sets critHeal to 1 / 1.5 / 2 at ★1 / ★2 / ★3, nothing otherwise', () => {
    expect(full([at('toaster')]).critHeal).toBe(0);
    [1, 1.5, 2].forEach((h, i) => expect(full([at('toaster'), far('sample', i + 1)]).critHeal).toBe(h));
  });

  it('changes nothing but critHeal', () => {
    const plain = full([at('nailgun')]), withSample = full([at('nailgun'), far('sample', 3)]); // a non-kitchen weapon: the Kitchen set stays at 0
    expect(withSample.weapons).toEqual(plain.weapons);
    expect({ ...withSample, critHeal: 0 }).toEqual({ ...plain, critHeal: 0 });
  });

  it('does not stack: the best copy counts once', () => {
    expect(full([at('toaster'), far('sample', 1), far('sample', 3)]).critHeal).toBe(2);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4: 2.5 HP)', () => {
    expect(full([at('toaster'), corner('sample', 3), gilded(1)]).critHeal).toBe(2.5);
  });
});

// The heal is a runtime hook: `onCrit` in the content file, capped per whole second through `c.state`.
describe('Free Sample: runtime', () => {
  /** A toaster with the sample and a crit that always lands (the real build has no crit source). */
  const setup = (tier: number, opts: Parameters<typeof arena>[1] = {}) => {
    const a = arena([at('toaster'), far('sample', tier)], { hp: 50, maxHp: 100, ...opts });
    const sure = { ...a.stats, critChance: 1 };
    return { ...a, sure, crit: () => a.fake.hit(a.fake.spawnEnemy({ hp: 1000 }), 1, sure) };
  };

  it('heals once per crit by tier: 1 / 1.5 / 2 HP, with a green spark at the goblin', () => {
    for (const [tier, heal] of [[1, 1], [2, 1.5], [3, 2]] as const) {
      const { fake, crit } = setup(tier);
      fake.player.x = 40; fake.player.y = 60;
      crit();
      expect(fake.callsOf('heal')).toEqual([{ at: 0, kind: 'heal', hp: heal }]);
      expect(fake.run.hp).toBe(50 + heal);
      expect(fake.callsOf('fx').filter((c) => c.method === 'spark').map((c) => c.args)).toEqual([[40, 14, 2, 0x8fcb57]]);
    }
  });

  it('caps the healing at 2 HP per whole second across crits, and resets when the second changes', () => {
    const { fake, crit } = setup(2); // 1.5 per crit
    crit(); crit(); crit();
    expect(fake.callsOf('heal').map((c) => c.hp)).toEqual([1.5, 0.5]); // 1.5, then only the 0.5 left of the cap, then nothing
    expect(fake.run.hp).toBe(52);
    fake.advance(0.9); crit();
    expect(fake.run.hp).toBe(52); // still second 0
    fake.advance(0.2); // t = 1.1: a new second
    crit(); crit();
    expect(fake.callsOf('heal').map((c) => c.hp)).toEqual([1.5, 0.5, 1.5, 0.5]);
    expect(fake.run.hp).toBe(54);
  });

  it('the cap is a whole-second bucket, not a rolling window (crits at 0.99 s and 1.0 s both heal in full)', () => {
    const { fake, crit } = setup(3);
    fake.advance(0.99); crit();
    fake.advance(0.01); crit();
    expect(fake.callsOf('heal').map((c) => c.hp)).toEqual([2, 2]);
  });

  it('never heals past max HP', () => {
    const { fake, crit } = setup(3, { hp: 99.5, maxHp: 100 });
    crit();
    expect(fake.callsOf('heal').map((c) => c.hp)).toEqual([0.5]);
    expect(fake.run.hp).toBe(100);
    crit();
    expect(fake.callsOf('heal')).toHaveLength(1); // full: nothing to heal, nothing recorded
  });

  it('a dead goblin is not healed', () => {
    const { fake, crit } = setup(3);
    fake.player.dead = true;
    crit();
    expect(fake.callsOf('heal')).toEqual([]);
  });

  it('needs a crit source: hits that do not crit never heal', () => {
    const { fake, stats } = setup(3);
    expect(stats.critChance).toBe(0);
    for (let i = 0; i < 40; i++) fake.hit(fake.spawnEnemy({ hp: 1000 }), 1, stats);
    expect(fake.callsOf('heal')).toEqual([]);
  });

  it('works with a real crit source (Fortune Cookie) and the seeded crit roll', () => {
    const a = arena([at('toaster'), far('sample', 3), far('fortune', 3)], { hp: 10, maxHp: 100, seed: 3 });
    expect(a.stats.critChance).toBeCloseTo(0.1, 12);
    let crits = 0;
    for (let i = 0; i < 400; i++) {
      a.fake.advance(1); // a fresh second each time: the cap never bites
      const e = a.fake.spawnEnemy({ hp: 1000 });
      const before = a.fake.callsOf('heal').length;
      a.fake.hit(e, 1, a.stats);
      if (a.fake.callsOf('heal').length > before) crits++;
      a.fake.run.hp = 10;
    }
    expect(crits).toBeGreaterThan(15);
    expect(crits).toBeLessThan(70);
  });

  it('the cap state is per aisle: a fresh arena starts with a fresh second', () => {
    const first = setup(3); first.crit(); first.crit();
    const second = setup(3); second.crit();
    expect(second.fake.callsOf('heal').map((c) => c.hp)).toEqual([2]);
  });

  it('is inactive without the item', () => {
    const a = arena([at('toaster')], { hp: 50 });
    a.fake.hit(a.fake.spawnEnemy({ hp: 1000 }), 1, { ...a.stats, critChance: 1 });
    expect(a.fake.callsOf('heal')).toEqual([]);
  });
});

describe('Free Sample: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('sample')).toBe(sample);
    expect(ITEMS.sample).toMatchObject({ id: 'sample', family: 'kitchen', name: 'Free Sample', kind: 'passive', price: 10, electrical: false });
    expect(ITEMS.sample.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.sample.rules).toBe('Every crit heals {0} HP, at most 2 HP per second (does not stack). Needs a crit source like the Price Gun or Fortune Cookie.');
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('sample', t).heal)).toEqual([1, 1.5, 2, 2.5]);
    expect(contentTune('sample', 1).cap).toBe(2);
  });

  it('keeps its position in the item order', () => {
    expect(around('sample', 1, 1)).toEqual(['fortune', 'sample', 'piggy']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('sample', t))).toEqual([
      'Every crit heals +1 HP, at most 2 HP per second (does not stack). Needs a crit source like the Price Gun or Fortune Cookie.',
      'Every crit heals +1.5 HP, at most 2 HP per second (does not stack). Needs a crit source like the Price Gun or Fortune Cookie.',
      'Every crit heals +2 HP, at most 2 HP per second (does not stack). Needs a crit source like the Price Gun or Fortune Cookie.',
    ]);
    setLang('de');
    expect(itemRules('sample', 2)).toBe('Jeder Krit heilt +1,5 LP, höchstens 2 LP pro Sekunde (stapelt sich nicht). Braucht eine Kritquelle wie Preisauszeichner oder Glückskeks.');
    expect(itemT('sample')).toMatchObject({ name: 'Kostprobe', blurb: 'Nur zum Probieren. Jeder Krit ist ein Häppchen.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('sample')).toEqual([{ label: 'HP per crit', values: ['+1', '+1.5', '+2'] }]);
    setLang('de');
    expect(tierScaling('sample')).toEqual([{ label: 'LP pro Krit', values: ['+1', '+1,5', '+2'] }]);
  });
});
