import { describe, expect, it } from 'vitest';
import { arena, at } from '../helpers';

const dash = (fake: ReturnType<typeof arena>['fake']) => fake.hooks.emit('onDashStart', { x: 0, y: 0, dx: 1, dy: 0, reach: 130, chained: false });

describe('Vacuum: automatic Full Suck', () => {
  it('every 3rd dash triples the pull and doubles the range for 2 s and pulls every coin', () => {
    const { fake } = arena([at('vacuum')]);
    dash(fake); dash(fake);
    expect(fake.callsOf('boostWeapon')).toHaveLength(0);
    dash(fake);
    expect(fake.callsOf('boostWeapon')).toMatchObject([{ weapon: 'u0', pull: 3, range: 2, seconds: 2 }]);
    expect(fake.callsOf('pullCoins')).toHaveLength(1);
    dash(fake); dash(fake);
    expect(fake.callsOf('boostWeapon')).toHaveLength(1);
    dash(fake);
    expect(fake.callsOf('boostWeapon')).toHaveLength(2);
  });

  it('is off without dashing', () => {
    const { fake } = arena([at('vacuum')]);
    fake.tick(10);
    expect(fake.callsOf('boostWeapon')).toHaveLength(0);
  });
});
