import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import flag from '../../../src/content/items/flag';
import { contentComboTune, contentCombo, contentItem, contentTune } from '../../../src/engine/registry';
import { MARK_MULT } from '../../../src/engine/marks';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { combatRng } from '../../../src/systems/rng';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, corner, far, gilded } from '../helpers';

afterEach(() => setLang('en'));

const scenes = import.meta.glob('../../../src/scenes/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const sceneSource = (file: string): string => Object.entries(scenes).find(([k]) => k.endsWith(`/${file}`))![1];

// The mark is applied by an `onDashHit` hook (no rng). The x1.2 on marked enemies is NOT a Flag hook: Price Check marks too.
describe('Sale Flag: runtime', () => {
  const hitBy = (fake: ReturnType<typeof arena>['fake'], enemy: ReturnType<typeof fake.spawnEnemy>) => fake.hooks.emit('onDashHit', { enemy, dx: 1, dy: 0, dmg: 6 });

  it('marks every enemy the dash hits for 2 / 3 / 4 s from now (the scene clock)', () => {
    for (const [tier, secs] of [[1, 2], [2, 3], [3, 4]] as const) {
      const { fake } = arena([at('toaster'), far('flag', tier)]);
      fake.advance(10);
      const [a, b] = [fake.spawnEnemy(), fake.spawnEnemy()];
      hitBy(fake, a); hitBy(fake, b);
      expect(fake.callsOf('mark')).toEqual([{ at: 10, kind: 'mark', enemy: a.id, seconds: secs }, { at: 10, kind: 'mark', enemy: b.id, seconds: secs }]);
      expect([a.markedUntil, b.markedUntil]).toEqual([10 + secs, 10 + secs]);
    }
  });

  it('a second hit refreshes the mark from the new time (it is not extended)', () => {
    const { fake } = arena([at('toaster'), far('flag', 2)]);
    const e = fake.spawnEnemy();
    hitBy(fake, e);
    fake.advance(2);
    hitBy(fake, e);
    expect(e.markedUntil).toBe(2 + 3);
  });

  it('Gold Star\'s effective ★4 marks for 5 s, two copies count the best one', () => {
    const lifted = arena([at('toaster'), corner('flag', 3), gilded(1)]);
    const e = lifted.fake.spawnEnemy();
    hitBy(lifted.fake, e);
    expect(e.markedUntil).toBe(5);
    const two = arena([at('toaster'), far('flag', 1), far('flag', 2)]);
    hitBy(two.fake, e);
    expect(two.fake.callsOf('mark').map((c) => c.seconds)).toEqual([3]);
  });

  it('draws no random numbers (so it can sit next to the Tip Jar in either order)', () => {
    const { fake } = arena([at('toaster'), far('flag', 3)], { seed: 9 });
    for (let i = 0; i < 10; i++) hitBy(fake, fake.spawnEnemy());
    expect(fake.rng()).toBe(combatRng(9, 0)());
  });

  it('does nothing without the item', () => {
    const { fake } = arena([at('toaster')]);
    const e = fake.spawnEnemy();
    hitBy(fake, e);
    expect(fake.calls).toEqual([]);
    expect(e.markedUntil).toBeUndefined();
  });
});

// Ordering guards for the damage pipeline (docs/item-hooks-refactor.md §4c): the mark multiplier is engine behavior (engine/marks.ts),
// after the modifyDamage hooks (Five-Alarm) and before the crit roll.
describe('Sale Flag: the mark multiplier stays in the pipeline', () => {
  const arenaSource = sceneSource('ArenaScene.ts');
  const body = arenaSource.slice(arenaSource.indexOf('damageEnemy(e: Enemy'), arenaSource.indexOf('/** Kitchen L2 heal'));

  it('has no modifyDamage hook: a mark has two writers (the dash and Price Check\'s beam), so x1.2 would be lost for Price Check carts', () => {
    expect(flag.hooks?.modifyDamage).toBeUndefined();
    expect(contentCombo('priceCheck')!.hooks!['pattern:beam']).toBeTypeOf('function'); // the beam marks too
  });

  it('applies the modifyDamage hooks (Five-Alarm) first, then the element affinity, then the mark, then the crit roll (the multiplication order of today)', () => {
    const at_ = (n: string) => { const i = body.indexOf(n); expect(i, n).toBeGreaterThan(-1); return i; };
    const order = ["H.emit('modifyDamage'", 'affinityMult(e.def, tags)', 'markedDamage(dmg, e.markedUntil, now, markMult(e.def))', 'this.rng() < stats.critChance'].map(at_);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('shows the same bonus the pipeline applies: 1 + bonus = the shared mark multiplier', () => {
    expect(1 + contentTune('flag', 1).bonus).toBe(contentComboTune('priceCheck').damageMult);
    expect(MARK_MULT).toBe(contentComboTune('priceCheck').damageMult);
  });
});

describe('Sale Flag: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('flag')).toBe(flag);
    expect(ITEMS.flag).toMatchObject({ id: 'flag', family: 'checkout', kind: 'passive', price: 10, electrical: false });
    expect(ITEMS.flag.cells).toEqual([{ x: 0, y: 0 }]);
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('flag', t).duration)).toEqual([2, 3, 4, 5]);
    expect(contentTune('flag', 1).bonus).toBe(0.2);
  });

  it('keeps its position in the item order', () => {
    expect(around('flag', 1, 1)).toEqual(['tipjar', 'flag', 'microwave']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('flag', t))).toEqual([
      'Groceries hit by the Space dash are marked for 2 s: they take +20% damage from everything (does not stack).',
      'Groceries hit by the Space dash are marked for 3 s: they take +20% damage from everything (does not stack).',
      'Groceries hit by the Space dash are marked for 4 s: they take +20% damage from everything (does not stack).',
    ]);
    setLang('de');
    expect(itemRules('flag', 2)).toBe('Vom Leertasten-Dash getroffene Gegner sind 3 s markiert: Sie erleiden +20% Schaden von allem (stapelt sich nicht).');
    expect(itemT('flag')).toMatchObject({ name: 'Sale-Fähnchen', blurb: 'Steck es ihnen in den Rücken. Alles 20% reduziert.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('flag')).toEqual([{ label: 'Mark time', values: ['2 s', '3 s', '4 s'] }]);
    setLang('de');
    expect(tierScaling('flag')).toEqual([{ label: 'Markierzeit', values: ['2 s', '3 s', '4 s'] }]);
  });
});
