import { describe, expect, it } from 'vitest';
import chickenDinner from '../../../src/content/combos/chickenDinner';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('chickenDinner', chickenDinner, ['Chicken Dinner', 'Hähnchen-Menü']);

describe('Chicken Dinner: runtime', () => {
  const sweep = (stats: never, stage: 'before' | 'hit' | 'after' = 'before') => ({ stats, stage, x: 0, y: 0, angle: 0, bonus: false, range: 100, dmg: 10, hits: [] as never[] });
  it('every 4th sweep is stronger: range x1.4, damage x2.5 (the others are untouched)', () => {
    const { fake, stats } = arena(partsOf(chickenDinner));
    const seen = Array.from({ length: 8 }, () => { const ev = sweep(stats as never); fake.hooks.emit('pattern:sweep', ev); return [ev.range, ev.dmg]; });
    seen.forEach(([r, d], i) => expect([r, d], `sweep ${i + 1}`).toEqual((i + 1) % 4 === 0 ? [140, 25] : [100, 10]));
  });
  it('only the "before" stage counts a sweep', () => {
    const { fake, stats } = arena(partsOf(chickenDinner));
    for (let i = 0; i < 9; i++) { fake.hooks.emit('pattern:sweep', sweep(stats as never, 'hit')); fake.hooks.emit('pattern:sweep', sweep(stats as never, 'after')); }
    const ev = sweep(stats as never); fake.hooks.emit('pattern:sweep', ev);
    expect(ev.dmg).toBe(10);
  });
  it('the count is per combo owner and starts fresh each aisle (a new arena)', () => {
    const a = arena(partsOf(chickenDinner)), b = arena(partsOf(chickenDinner));
    for (let i = 0; i < 3; i++) a.fake.hooks.emit('pattern:sweep', sweep(a.stats as never));
    const ev = sweep(b.stats as never); b.fake.hooks.emit('pattern:sweep', ev);
    expect(ev.dmg).toBe(10);
  });
  it('a pan without the combo is never boosted', () => {
    const { fake, stats } = arena([at('pan')]);
    for (let i = 0; i < 8; i++) { const ev = sweep(stats as never); fake.hooks.emit('pattern:sweep', ev); expect(ev.dmg).toBe(10); }
  });
});
