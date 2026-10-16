import { describe, expect, it } from 'vitest';
import tailwind from '../../../src/content/combos/tailwind';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('tailwind', tailwind, ['Tailwind', 'Rückenwind']);

type A = ReturnType<typeof arena>;
const cone = (a: A) => a.fake.hooks.emit('pattern:cone', { stats: a.stats, x: 0, y: 0, angle: 0, hits: [] });
const speed = (a: A) => a.fake.player.speedMods.tailwind(a.fake.now());

describe('Tailwind: runtime', () => {
  it('a blast while moving gives +30% speed for 0.4 s', () => {
    const a = arena(partsOf(tailwind), { player: { vx: 100 } });
    cone(a);
    expect(speed(a)).toBeCloseTo(1.3, 12);
    a.fake.advance(0.39);
    expect(speed(a)).toBeCloseTo(1.3, 12);
    a.fake.advance(0.02);
    expect(speed(a)).toBe(1);
  });
  it('standing still gives no push (the multiplier is registered but stays 1)', () => {
    const a = arena(partsOf(tailwind));
    cone(a);
    expect(speed(a)).toBe(1);
  });
  it('a leaf blower without the combo registers nothing', () => {
    const a = arena([at('leafblower')], { player: { vx: 100 } });
    a.fake.hooks.emit('pattern:cone', { stats: a.stats, x: 0, y: 0, angle: 0, hits: [] });
    expect(a.fake.player.speedMods.tailwind).toBeUndefined();
  });
  it('feeds a Sugar Rush stack when Sugar Rush is in the cart, at most once per 1.5 s', () => {
    const specs = [...partsOf(tailwind), { ...at('energy'), near: [2] }];
    const a = arena(specs, { player: { vx: 100 } });
    expect(a.b.recipes.map((r) => r.id)).toEqual(expect.arrayContaining(['tailwind', 'sugarRush']));
    cone(a);
    a.fake.advance(1.4); cone(a);
    expect(a.fake.player.speedMods.sugarRush).toBeUndefined(); // the stack list is Sugar Rush's; its own tick registers the multiplier
    a.fake.tick(0.1);
    expect(a.fake.lines.get('sugarRush')!.text).toBe('SUGAR #');
    a.fake.advance(0.1); cone(a);                        // 1.5 s after the first feed
    a.fake.tick(0.01);
    expect(a.fake.lines.get('sugarRush')!.text).toBe('SUGAR ##');
  });
  it('without Sugar Rush nothing is fed and nothing else happens', () => {
    const a = arena(partsOf(tailwind), { player: { vx: 100 } });
    cone(a);
    expect(a.fake.callsOf('line')).toHaveLength(0);
  });
  it('draws no random numbers', () => {
    const a = arena(partsOf(tailwind), { seed: 7, player: { vx: 50 } });
    cone(a); cone(a);
    expect(a.fake.rng()).toBe(arena(partsOf(tailwind), { seed: 7 }).fake.rng());
  });
});
