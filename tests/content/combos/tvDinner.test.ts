import { describe, expect, it } from 'vitest';
import tvDinner from '../../../src/content/combos/tvDinner';
import { applyCombo, arena, bare, describeCombo, partsOf } from './helpers';

describeCombo('tvDinner', tvDinner, ['TV Dinner', 'Fertiggericht']);

const zap = (stats: ReturnType<typeof arena>['stats'], link: number, stage: 'before' | 'hit' | 'after' = 'before') => {
  const target = { id: 1 } as never;
  return { stats, stage, link, target, damageMult: 1, hits: [] as never[] };
};

describe('TV Dinner: build', () => {
  it('adds one chain link and trims the cooldown to x0.92', () => {
    const base = bare('microwave'), w = applyCombo(tvDinner, base);
    expect(w.chain).toBe(base.chain + 1);
    expect(w.cooldown).toBe(base.cooldown * 0.92);
  });
});

describe('TV Dinner: runtime', () => {
  it('every chain link (not the first target) deals 60% damage in the zap "before" stage', () => {
    const { fake, stats } = arena(partsOf(tvDinner));
    for (const [link, want] of [[0, 1], [1, 0.6], [2, 0.6]] as const) {
      const ev = zap(stats, link);
      fake.hooks.emit('pattern:zap', ev);
      expect(ev.damageMult, `link ${link}`).toBe(want);
    }
  });
  it('does nothing in the hit/after stages and for a weapon without the combo', () => {
    const { fake, stats } = arena(partsOf(tvDinner));
    for (const stage of ['hit', 'after'] as const) { const ev = zap(stats, 1, stage); fake.hooks.emit('pattern:zap', ev); expect(ev.damageMult).toBe(1); }
    const ev = zap({ ...stats, uid: 'other' }, 1);
    fake.hooks.emit('pattern:zap', ev);
    expect(ev.damageMult).toBe(1);
  });
});
