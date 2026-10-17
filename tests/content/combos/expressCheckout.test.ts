import { describe, expect, it } from 'vitest';
import expressCheckout from '../../../src/content/combos/expressCheckout';
import { arena, at, describeCombo, partsOf } from './helpers';

describeCombo('expressCheckout', expressCheckout, ['Express Checkout', 'Schnellkasse']);

describe('Express Checkout: text', () => {
  it('spells the cooldown as a literal (the s formatter would print "1 s"), so it must follow tune.icd', () => {
    const icd = expressCheckout.tune!.icd as number;
    expect(expressCheckout.text.en.detail).toContain(`(${icd.toFixed(1)} s internal cooldown)`);
    expect(expressCheckout.text.de.detail).toContain(`(${icd.toFixed(1).replace('.', ',')} s interne Abklingzeit)`);
  });
});

describe('Express Checkout: build', () => {
  it('changes no stats: the bonus sweep is the onDashEnd hook', () => {
    expect(expressCheckout.build).toBeUndefined();
  });
});

describe('Express Checkout: runtime', () => {
  const dashEnd = (hit: boolean) => ({ x: 100, y: 50, dx: 0, dy: 1, hit });
  it('a dash that connected sweeps once more along the dash direction (bonus sweep), with the ding and the receipt', () => {
    const { fake, stats } = arena(partsOf(expressCheckout));
    fake.hooks.emit('onDashEnd', dashEnd(true));
    expect(fake.callsOf('sweep')).toEqual([expect.objectContaining({ weapon: stats.uid, angle: Math.atan2(1, 0), bonus: true })]);
    expect(fake.callsOf('sound').map((s) => s.name)).toContain('ding');
    expect(fake.callsOf('fx').some((f) => f.method === 'popImage' && f.args[0] === 'fx_receipt_burst')).toBe(true);
  });
  it('a dash that hit nothing does nothing', () => {
    const { fake } = arena(partsOf(expressCheckout));
    fake.hooks.emit('onDashEnd', dashEnd(false));
    expect(fake.calls).toHaveLength(0);
  });
  it('1 s internal cooldown per pan: a second dash inside it does not sweep, one after it does', () => {
    const { fake } = arena(partsOf(expressCheckout));
    fake.hooks.emit('onDashEnd', dashEnd(true));
    fake.advance(0.99);
    fake.hooks.emit('onDashEnd', dashEnd(true));
    expect(fake.callsOf('sweep')).toHaveLength(1);
    fake.advance(0.02);
    fake.hooks.emit('onDashEnd', dashEnd(true));
    expect(fake.callsOf('sweep')).toHaveLength(2);
  });
  it('each pan has its own cooldown (a second pan with the combo sweeps although the first is cooling down)', () => {
    const { fake, b, stats } = arena([...partsOf(expressCheckout), { ...at('pan'), near: [], apart: [0, 1] }, { ...at('bell'), near: [2], apart: [0] }]);
    expect(b.weapons.filter((w) => w.recipes.includes('expressCheckout'))).toHaveLength(2);
    fake.hooks.emit('onDashEnd', dashEnd(true));
    expect(fake.callsOf('sweep').map((s) => s.weapon).sort()).toEqual(b.weapons.map((w) => w.uid).sort());
    fake.advance(0.5);
    fake.hooks.emit('onDashEnd', dashEnd(true));
    expect(fake.callsOf('sweep')).toHaveLength(2);
    expect(stats.uid).toBe('u0');
  });
  it('draws no random numbers', () => {
    const { fake } = arena(partsOf(expressCheckout), { seed: 4 });
    fake.hooks.emit('onDashEnd', dashEnd(true));
    expect(fake.rng()).toBe(arena(partsOf(expressCheckout), { seed: 4 }).fake.rng());
  });
});
