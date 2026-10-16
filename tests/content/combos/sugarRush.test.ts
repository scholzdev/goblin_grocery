import { describe, expect, it } from 'vitest';
import sugarRush from '../../../src/content/combos/sugarRush';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('sugarRush', sugarRush, ['Sugar Rush', 'Zuckerschock']);

type A = ReturnType<typeof arena>;
const dash = (a: A) => a.fake.hooks.emit('onDashStart', { x: 0, y: 0, dx: 1, dy: 0, reach: 100, chained: false });
const speed = (a: A) => a.fake.player.speedMods.sugarRush(a.fake.now());

describe('Sugar Rush (cart combo): runtime', () => {
  it('each dash adds a stack: +8% move speed, shown as "SUGAR #" per stack', () => {
    const a = arena(partsOf(sugarRush));
    dash(a);
    expect(speed(a)).toBeCloseTo(1.08, 12);
    expect(a.fake.lines.get('sugarRush')).toEqual({ text: 'SUGAR #', order: 0 });
    dash(a); dash(a);
    expect(speed(a)).toBeCloseTo(1.24, 12);
    expect(a.fake.lines.get('sugarRush')!.text).toBe('SUGAR ###');
  });
  it('caps at 5 stacks (+40%); a dash at the cap refreshes the oldest stack', () => {
    const a = arena(partsOf(sugarRush));
    for (let i = 0; i < 8; i++) { a.fake.advance(0.1); dash(a); }
    expect(speed(a)).toBeCloseTo(1.4, 12);
    expect(a.fake.lines.get('sugarRush')!.text).toBe('SUGAR #####');
  });
  it('every stack expires on its own after 3 s; the text follows on the next tick (one setLine per change) and disappears', () => {
    const a = arena(partsOf(sugarRush));
    dash(a); a.fake.advance(1); dash(a);
    a.fake.tick(1.9);                       // t = 2.9: both still on
    expect(a.fake.lines.get('sugarRush')!.text).toBe('SUGAR ##');
    a.fake.tick(0.2);                       // t = 3.1: first one gone
    expect(a.fake.lines.get('sugarRush')!.text).toBe('SUGAR #');
    expect(speed(a)).toBeCloseTo(1.08, 12);
    a.fake.tick(1);                         // t = 4.1: second gone
    expect(a.fake.lines.get('sugarRush')).toBeNull();
    expect(speed(a)).toBe(1);
  });
  it('ticking without a change makes no further setLine calls', () => {
    const a = arena(partsOf(sugarRush));
    dash(a);
    const n = a.fake.callsOf('line').length;
    for (let i = 0; i < 10; i++) a.fake.tick(0.1);
    expect(a.fake.callsOf('line')).toHaveLength(n);
  });
  it('draws no random numbers', () => {
    const a = arena(partsOf(sugarRush), { seed: 8 });
    for (let i = 0; i < 4; i++) { dash(a); a.fake.tick(0.5); }
    expect(a.fake.rng()).toBe(arena(partsOf(sugarRush), { seed: 8 }).fake.rng());
  });
});
