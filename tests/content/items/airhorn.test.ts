import { describe, expect, it } from 'vitest';
import { arena, at, far } from '../helpers';

const horn = (tier = 1) => arena([at('toaster'), far('airhorn', tier)]);
const crowd = (fake: ReturnType<typeof horn>['fake'], n: number, x = 80) => Array.from({ length: n }, (_, i) => fake.spawnEnemy({ x: x + i, y: 0 }));

describe('Air Horn: automatic blast', () => {
  it('stays silent below 8 enemies near the cart, and blows once the 8th arrives', () => {
    const { fake } = horn();
    const es = crowd(fake, 7);
    fake.tick(0.1);
    expect(fake.callsOf('stun')).toHaveLength(0);
    es.push(fake.spawnEnemy({ x: 90 }));
    fake.tick(0.1);
    expect(es.map((e) => e.state)).toEqual(Array(8).fill('stun'));
  });

  it('enemies far from the cart do not count, but the blast stuns everyone on screen', () => {
    const { fake } = horn();
    crowd(fake, 7);
    const faraway = fake.spawnEnemy({ x: 600 });
    fake.tick(0.1);
    expect(fake.callsOf('stun')).toHaveLength(0);
    fake.spawnEnemy({ x: 100 });
    fake.tick(0.1);
    expect([faraway.state, faraway.stateT]).toEqual(['stun', 1]);
  });

  it('stuns for 1 / 1.3 / 1.5 s, a boss only for 0.3 s', () => {
    [1, 1.3, 1.5].forEach((s, i) => {
      const { fake } = horn(i + 1);
      const es = crowd(fake, 8);
      fake.tick(0.1);
      expect(es[0].stateT).toBe(s);
    });
    const { fake } = horn();
    crowd(fake, 8);
    const boss = fake.spawnEnemy({ x: 100, def: { behavior: 'boss' } });
    fake.tick(0.1);
    expect(boss).toMatchObject({ state: 'stun', stateT: 0.3 });
  });

  it('1 charge per aisle at ★1 / ★2, 2 at ★3 with a gap of 2 s', () => {
    for (const [tier, blasts] of [[1, 1], [2, 1], [3, 2]] as const) {
      const { fake } = horn(tier);
      crowd(fake, 8);
      for (let i = 0; i < 400; i++) { fake.tick(0.05); for (const e of fake.alive()) { e.state = 'walk'; e.stateT = 0; } }
      expect(fake.callsOf('stun').length / 8).toBe(blasts);
    }
  });

  it('the second ★3 charge waits for the gap, not the next frame', () => {
    const { fake } = horn(3);
    crowd(fake, 8);
    fake.tick(0.05);
    const first = fake.callsOf('stun').length;
    for (let i = 0; i < 30; i++) { fake.tick(0.05); for (const e of fake.alive()) e.state = 'walk'; }
    expect(fake.callsOf('stun')).toHaveLength(first); // 1.5 s later: still in the gap
    for (let i = 0; i < 20; i++) { fake.tick(0.05); for (const e of fake.alive()) e.state = 'walk'; }
    expect(fake.callsOf('stun').length).toBe(first * 2);
  });
});
