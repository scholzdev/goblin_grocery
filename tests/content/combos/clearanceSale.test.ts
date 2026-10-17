import { describe, expect, it } from 'vitest';
import clearanceSale from '../../../src/content/combos/clearanceSale';
import { setLang } from '../../../src/i18n/lang';
import { applyCombo, arena, bare, describeCombo, draws, partsOf } from './helpers';

describeCombo('clearanceSale', clearanceSale, ['Clearance Sale', 'Räumungsverkauf']);

describe('Clearance Sale: build', () => {
  it('adds two bounces (the coin itself is the onCrit hook)', () => {
    const base = bare('fizz'), w = applyCombo(clearanceSale, base);
    expect(w.bounces).toBe(base.bounces + 2);
  });
});

describe('Clearance Sale: runtime', () => {
  it('a crit drops one coin at the enemy, labelled "Clearance Sale" (EN) / "Räumungsverkauf" (DE)', () => {
    const { fake, stats } = arena(partsOf(clearanceSale));
    const e = fake.spawnEnemy({ hp: 1000, x: 5, y: 6 });
    fake.hit(e, 4, { ...stats, critChance: 1 });
    expect(fake.callsOf('dropCoin')).toEqual([expect.objectContaining({ x: 5, y: 6, label: 'Clearance Sale' })]);
    setLang('de');
    try {
      const e2 = fake.spawnEnemy({ hp: 1000 });
      fake.hit(e2, 4, { ...stats, critChance: 1 });
      expect(fake.callsOf('dropCoin').at(-1)!.label).toBe('Räumungsverkauf');
    } finally { setLang('en'); }
  });
  it('once per enemy: further crits on the same enemy drop nothing, a new enemy drops again', () => {
    const { fake, stats } = arena(partsOf(clearanceSale));
    const e = fake.spawnEnemy({ hp: 1000 });
    for (let i = 0; i < 4; i++) fake.hit(e, 4, { ...stats, critChance: 1 });
    expect(fake.callsOf('dropCoin')).toHaveLength(1);
    expect(e.critCoinDropped).toBe(true);
    fake.hit(fake.spawnEnemy({ hp: 1000 }), 4, { ...stats, critChance: 1 });
    expect(fake.callsOf('dropCoin')).toHaveLength(2);
  });
  it('no coin without a crit, and a fizz without the combo gets none', () => {
    const { fake, stats } = arena(partsOf(clearanceSale), { seed: 2 });
    fake.hit(fake.spawnEnemy({ hp: 1000 }), 4, { ...stats, critChance: 0 });
    expect(fake.callsOf('dropCoin')).toHaveLength(0);
    const plain = arena([{ type: 'fizz' }]);
    plain.fake.hit(plain.fake.spawnEnemy({ hp: 1000 }), 4, { ...plain.stats, critChance: 1 });
    expect(plain.fake.callsOf('dropCoin')).toHaveLength(0);
  });
  it('rng: only the crit roll draws (one number per hit; the coin itself draws none)', () => {
    const { fake, stats } = arena(partsOf(clearanceSale), { seed: 9 });
    const e = fake.spawnEnemy({ hp: 1000 });
    for (let i = 0; i < 5; i++) fake.hit(e, 4, { ...stats, critChance: 1 });
    expect(fake.rng()).toBe(draws(9, 6)[5]);
  });
});
