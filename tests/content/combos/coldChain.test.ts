import { describe, expect, it } from 'vitest';
import coldChain from '../../../src/content/combos/coldChain';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('coldChain', coldChain, ['Cold Chain', 'Kühlkette']);

describe('Cold Chain: runtime', () => {
  const after = (stats: never, target: never, echo = false) => ({ stats, target, echo, stage: 'after' as const, angle: 0, targets: [target], damageMult: 1, hits: [target] });
  it('freezes on the 3rd beam in a row at the same enemy, and again on the 6th', () => {
    const { fake, stats } = arena(partsOf(coldChain));
    const e = fake.spawnEnemy({ x: 100 });
    for (let i = 1; i <= 6; i++) {
      fake.hooks.emit('pattern:beam', after(stats as never, e as never));
      expect(fake.callsOf('stun')).toHaveLength(Math.floor(i / 3));
    }
    expect(fake.callsOf('stun')[0]).toMatchObject({ enemy: e.id, tag: 'frost' });
  });
  it('aiming at another enemy restarts the count, and echo beams are ignored', () => {
    const { fake, stats } = arena(partsOf(coldChain));
    const a = fake.spawnEnemy(), b = fake.spawnEnemy();
    const fire = (e: typeof a, echo = false) => fake.hooks.emit('pattern:beam', after(stats as never, e as never, echo));
    fire(a); fire(a); fire(b); fire(a); fire(a);
    expect(fake.callsOf('stun')).toHaveLength(0);
    fire(a, true);
    expect(fake.callsOf('stun')).toHaveLength(0);
    fire(a);
    expect(fake.callsOf('stun')).toHaveLength(1);
  });
});
