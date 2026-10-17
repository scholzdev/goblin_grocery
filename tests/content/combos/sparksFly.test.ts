import { describe, expect, it } from 'vitest';
import sparksFly from '../../../src/content/combos/sparksFly';
import tvDinner from '../../../src/content/combos/tvDinner';
import { applyCombo, arena, bare, describeCombo, draws, partsOf } from './helpers';

describeCombo('sparksFly', sparksFly, ['Sparks Fly', 'Funkenflug']);

describe('Sparks Fly: text', () => {
  it('names TV Dinner by its own name in each language (the DE name is Fertiggericht)', () => {
    expect(tvDinner.text.de.name).toBe('Fertiggericht');
    expect(sparksFly.text.en.detail).toContain(tvDinner.text.en.name);
    expect(sparksFly.text.de.detail).toContain(tvDinner.text.de.name);
    expect(sparksFly.text.de.detail).not.toContain('TV-Dinner');
  });
});

describe('Sparks Fly: build', () => {
  it('adds two chain links', () => {
    const base = bare('microwave');
    expect(applyCombo(sparksFly, base).chain).toBe(base.chain + 2);
  });
});

describe('Sparks Fly: runtime', () => {
  const zap = (stats: never, target: never, link: number, stage: 'before' | 'hit' | 'after', enemy?: never) => ({ stats, target, link, stage, damageMult: 1, hits: [], enemy });
  it('the last two chain links deal 50% damage (before stage); the first target is full damage', () => {
    const { fake, stats } = arena(partsOf(sparksFly));
    const e = fake.spawnEnemy();
    const mults = Array.from({ length: stats.chain + 1 }, (_, link) => { const ev = zap(stats as never, e as never, link, 'before'); fake.hooks.emit('pattern:zap', ev); return ev.damageMult; });
    expect(mults[0]).toBe(1);
    expect(mults.slice(1).filter((m) => m === 0.5)).toHaveLength(2);
    expect(mults.slice(1).at(-1)).toBe(0.5);
  });
  it('stun roll: one draw per damaged chain link (hit stage, link >= 1, alive), 25% for 0.3 s', () => {
    const { fake, stats } = arena(partsOf(sparksFly), { seed: 31 });
    const want = draws(31, 40).map((r) => r < 0.25);
    expect(want.some(Boolean) && want.some((x) => !x)).toBe(true);
    for (let i = 0; i < 40; i++) {
      const before = fake.callsOf('stun').length, e = fake.spawnEnemy();
      fake.hooks.emit('pattern:zap', zap(stats as never, e as never, 1 + (i % 2), 'hit', e as never));
      expect(fake.callsOf('stun').length - before, `#${i}`).toBe(want[i] ? 1 : 0);
      if (want[i]) expect(fake.callsOf('stun').at(-1)).toMatchObject({ enemy: e.id, seconds: 0.3 });
    }
    expect(fake.rng()).toBe(draws(31, 41)[40]);
  });
  it('no roll for the first target, a dead enemy, or the before/after stages', () => {
    const { fake, stats } = arena(partsOf(sparksFly), { seed: 31 });
    const e = fake.spawnEnemy(), dead = fake.spawnEnemy({ alive: false });
    fake.hooks.emit('pattern:zap', zap(stats as never, e as never, 0, 'hit', e as never));
    fake.hooks.emit('pattern:zap', zap(stats as never, dead as never, 1, 'hit', dead as never));
    fake.hooks.emit('pattern:zap', zap(stats as never, e as never, 1, 'after'));
    expect(fake.rng()).toBe(draws(31, 1)[0]);
  });
  it('order guard: Sparks Fly (order 10) overrides TV Dinner\'s 60% chain damage on the last two links (microwave + lunchbox + battery + tinfoil hat)', () => {
    const { fake, stats } = arena([...partsOf(sparksFly), { type: 'lunchbox' }]);
    expect(stats.recipes).toEqual(expect.arrayContaining(['sparksFly', 'tvDinner']));
    const e = fake.spawnEnemy();
    const last = zap(stats as never, e as never, stats.chain, 'before'), first = zap(stats as never, e as never, 1, 'before');
    fake.hooks.emit('pattern:zap', last); fake.hooks.emit('pattern:zap', first);
    expect(last.damageMult).toBe(0.5);
    expect(first.damageMult).toBe(stats.chain - 2 >= 1 ? 0.6 : 0.5);
  });
});
