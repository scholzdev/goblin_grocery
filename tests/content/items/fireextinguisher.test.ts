import { describe, expect, it } from 'vitest';
import { arena, at, far } from '../helpers';

const ext = (tier = 1) => arena([at('toaster'), far('fireextinguisher', tier)]);

describe('Fire Extinguisher: automatic blast', () => {
  it('fires every 6 / 5 / 4 s at the nearest enemy', () => {
    [6, 5, 4].forEach((cd, i) => {
      const { fake } = ext(i + 1);
      const e = fake.spawnEnemy({ x: 100, hp: 1000 });
      fake.tick(cd - 0.1);
      expect(e.hp).toBe(1000);
      fake.tick(0.2);
      expect(e.hp).toBe(994);
    });
  });

  it('cone, damage, slow, stun and knockback are the same as the old active', () => {
    const { fake } = ext();
    const front = fake.spawnEnemy({ x: 100, y: 10, hp: 100 });
    const behind = fake.spawnEnemy({ x: -120, y: 0, hp: 100 });
    const out = fake.spawnEnemy({ x: 400, y: 0, hp: 100 });
    const side = fake.spawnEnemy({ x: 100, y: 100, hp: 100 });
    fake.tick(6.1);
    expect(front).toMatchObject({ hp: 94, state: 'stun', stateT: 0.6 });
    expect(front.status.slowPct).toBe(0.4);
    expect([behind.hp, out.hp, side.hp]).toEqual([100, 100, 100]);
    expect(fake.callsOf('damage')[0].opts).toMatchObject({ kb: 200 });
  });

  it('waits while nobody is in range, then fires at once; then a full cooldown again', () => {
    const { fake } = ext();
    fake.tick(10);
    expect(fake.callsOf('damage')).toHaveLength(0);
    const e = fake.spawnEnemy({ x: 100, hp: 1000 });
    fake.tick(0.05);
    expect(e.hp).toBe(994);
    e.state = 'walk';
    fake.tick(5.9);
    expect(e.hp).toBe(994);
    fake.tick(0.2);
    expect(e.hp).toBe(988);
  });

  it('has no charges tune', () => {
    expect(ext().b).toBeDefined();
    expect(Object.keys(ext().inv.placed[1])).not.toContain('charges');
  });
});
