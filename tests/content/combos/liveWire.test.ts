import { describe, expect, it } from 'vitest';
import liveWire from '../../../src/content/combos/liveWire';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('liveWire', liveWire, ['Live Wire', 'Stromschlag']);

describe('Live Wire: runtime', () => {
  const enter = (stats: never, enemy: never) => ({ stats, enemy, puddle: { x: 0, y: 0, r: 60 }, first: true, slow: { pct: 0.25, duration: 0.5 } });
  const setup = () => {
    const { fake, stats } = arena(partsOf(liveWire));
    const wetEnemy = (n = 1) => Array.from({ length: n }, () => { const e = fake.spawnEnemy({ hp: 1000 }); fake.wet(e, 5); return e; });
    const visit = (es: ReturnType<typeof wetEnemy>) => es.forEach((e) => fake.hooks.emit('pattern:puddleEnter', enter(stats as never, e as never)));
    fake.clear();
    return { fake, stats, wetEnemy, visit };
  };
  it('zaps a Wet enemy that was in a puddle once per second, for the puddle tick damage, quiet and untagged', () => {
    const { fake, stats, wetEnemy, visit } = setup();
    const [e] = wetEnemy();
    fake.tick(0.5);
    expect(fake.callsOf('damage')).toHaveLength(0);
    visit([e]);
    fake.tick(0.5);
    const [d] = fake.callsOf('damage');
    expect(d.enemy).toBe(e.id);
    expect(d.dmg).toBe(stats.damage);
    expect(d.source).toBe(stats.uid);
    expect(d.opts).toEqual({ quiet: true });
    expect(fake.callsOf('boltFx')).toHaveLength(1);
  });
  it('zaps at most 3 enemies, and only Wet, living, recently-visited ones', () => {
    const { fake, wetEnemy, visit } = setup();
    const wet = wetEnemy(5), dry = fake.spawnEnemy({ hp: 1000 }), dead = wetEnemy(1)[0];
    fake.tick(0.8);
    visit([...wet, dry, dead]);
    dead.alive = false;
    fake.tick(0.2);
    const hit = fake.callsOf('damage').map((d) => d.enemy);
    expect(hit).toEqual(wet.slice(0, 3).map((e) => e.id));
    expect(hit).not.toContain(dry.id);
  });
  it('forgets an enemy that left the puddle more than 0.6 s before the zap, and zaps it again after a fresh visit', () => {
    const { fake, wetEnemy, visit } = setup();
    const [e] = wetEnemy();
    visit([e]);
    fake.tick(1);
    expect(fake.callsOf('damage')).toHaveLength(0);
    fake.wet(e, 5);
    fake.tick(0.8);
    visit([e]);
    fake.tick(0.2);
    expect(fake.callsOf('damage')).toHaveLength(1);
  });
  it('a long stretch before the first visit does not bank zaps: still one per second after it', () => {
    const { fake, wetEnemy, visit } = setup();
    const [e] = wetEnemy();
    for (let i = 0; i < 300; i++) fake.tick(1 / 60);
    fake.wet(e, 5);
    visit([e]);
    for (let i = 0; i < 30; i++) { fake.tick(1 / 60); visit([e]); }
    expect(fake.callsOf('damage')).toHaveLength(1);
  });
  it('ignores a puddle of a weapon the Battery does not touch', () => {
    const { fake, stats, wetEnemy } = setup();
    const [e] = wetEnemy();
    fake.hooks.emit('pattern:puddleEnter', enter({ ...stats, uid: 'other' } as never, e as never));
    fake.tick(1);
    expect(fake.callsOf('damage')).toHaveLength(0);
  });
});
