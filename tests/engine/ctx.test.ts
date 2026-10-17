import { describe, expect, it } from 'vitest';
import { FX_METHODS } from '../../src/engine/ctx';
import { FakeCtx } from '../../src/engine/fakeCtx';
import { compileHooks } from '../../src/engine/hooks';
import { combatRng } from '../../src/systems/rng';

// FakeCtx: the deterministic stand-in phase 4's per-item tests drive hooks through.

const draw = (c: FakeCtx, n = 8) => Array.from({ length: n }, () => c.rng());

describe('FakeCtx determinism', () => {
  it('the same seed and aisle give the same rng sequence; another seed or aisle does not', () => {
    expect(draw(new FakeCtx({ seed: 42, aisle: 2 }))).toEqual(draw(new FakeCtx({ seed: 42, aisle: 2 })));
    expect(draw(new FakeCtx({ seed: 42, aisle: 2 }))).not.toEqual(draw(new FakeCtx({ seed: 43, aisle: 2 })));
    expect(draw(new FakeCtx({ seed: 42, aisle: 2 }))).not.toEqual(draw(new FakeCtx({ seed: 42, aisle: 3 })));
  });

  it('is the arena\'s combat rng: same stream as combatRng(seed, aisle)', () => {
    const real = combatRng(99, 5);
    expect(draw(new FakeCtx({ seed: 99, aisle: 5 }))).toEqual(Array.from({ length: 8 }, () => real()));
  });

  it('values are in [0, 1)', () => {
    for (const v of draw(new FakeCtx(), 500)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });

  it('the clock only moves when the test moves it', () => {
    const c = new FakeCtx();
    expect(c.now()).toBe(0);
    c.advance(1.5);
    expect(c.now()).toBe(1.5);
    c.tick(0.5);
    expect(c.now()).toBe(2);
  });
});

describe('FakeCtx recording', () => {
  it('records damage with the clock, source and opts, and applies it to the in-memory enemy', () => {
    const c = new FakeCtx();
    const e = c.spawnEnemy({ hp: 10 });
    c.advance(2);
    c.damage(e, 4, null, { label: 'Boot', kb: 5 });
    expect(c.calls).toEqual([{ at: 2, kind: 'damage', enemy: e.id, dmg: 4, source: null, opts: { label: 'Boot', kb: 5 } }]);
    expect(e.hp).toBe(6);
    c.damage(e, 6, null);
    expect(e.alive).toBe(false);
  });

  it('records statuses and applies them (burn, slow, poison, mark, stun)', () => {
    const c = new FakeCtx({ burnMult: 2 });
    const e = c.spawnEnemy({ hp: 100 });
    c.ignite(e, { dps: 3, duration: 2, tick: 0.5 });
    c.slow(e, { pct: 0.3, duration: 4 });
    c.poison(e, 1, 5);
    c.mark(e, 3);
    c.stun(e, 1);
    expect(e.status.burnDps).toBe(6); // the aisle's burn modifier went through ctx.aisle.burn
    expect(e.status.burnUntil).toBe(2);
    expect(e.status.slowPct).toBe(0.3);
    expect(e.status.poisonDps).toBe(1);
    expect(e.markedUntil).toBe(3);
    expect(e.state).toBe('stun');
    expect(c.calls.map((x) => x.kind)).toEqual(['ignite', 'slow', 'poison', 'mark', 'stun']);
  });

  it('a re-mark only extends: a shorter one never cuts a longer one, a longer one extends it', () => {
    const c = new FakeCtx();
    const e = c.spawnEnemy({ hp: 100 });
    c.mark(e, 4); // Sale Flag
    c.advance(1);
    c.mark(e, 3); // Price Check at t=1 would end at 4: not earlier than the flag's 4
    expect(e.markedUntil).toBe(4);
    c.advance(1);
    c.mark(e, 3); // t=2 -> 5, longer than 4
    expect(e.markedUntil).toBe(5);
    c.mark(e, 1); // 3 < 5
    expect(e.markedUntil).toBe(5);
  });

  it('records coins, heals (capped), hurt, sounds and every fx method', () => {
    const c = new FakeCtx({ hp: 90, maxHp: 100, money: 5 });
    c.dropCoin({ x: 1, y: 2 }, 'tip');
    c.addCoins(3, 'sale');
    c.heal(50);
    c.sound('ding', { rate: 1.2 });
    for (const m of FX_METHODS) (c.fx as unknown as Record<string, (...a: unknown[]) => void>)[m](1, 2);
    expect(c.run).toMatchObject({ hp: 100, money: 8 });
    expect(c.callsOf('dropCoin')).toEqual([{ at: 0, kind: 'dropCoin', x: 1, y: 2, label: 'tip' }]);
    expect(c.callsOf('sound')[0]).toMatchObject({ name: 'ding', opts: { rate: 1.2 } });
    expect(c.callsOf('fx').map((x) => x.method)).toEqual([...FX_METHODS]);
    c.clear();
    expect(c.calls).toEqual([]);
  });

  it('hurt respects i-frames, and onPlayerHit hooks can lower the damage', () => {
    const c = new FakeCtx({ hp: 100, maxHp: 100 });
    const table = compileHooks([{ id: 'wrap', kind: 'item', tier: 1, weapons: null, hooks: { onPlayerHit(ev) { ev.dmg = Math.max(1, ev.dmg - 3); ev.invuln += 0.5; } } }], c);
    c.attach(table);
    c.hurt(10);
    expect(c.run.hp).toBe(93);
    expect(c.player.invulnT).toBeGreaterThan(0.5);
    c.hurt(10); // inside the i-frames: nothing
    expect(c.run.hp).toBe(93);
    expect(c.callsOf('hurt')).toHaveLength(2); // the request is recorded either way
  });

  it('delay and tween callbacks run in due order when the clock reaches them', () => {
    const c = new FakeCtx();
    const log: string[] = [];
    const target = { alpha: 1 };
    c.delay(2, () => log.push('b'));
    c.delay(1, () => { log.push('a'); c.delay(0.5, () => log.push('a2')); });
    c.tween(target, { alpha: 0 }, 1500);
    c.advance(0.9);
    expect(log).toEqual([]);
    c.advance(1.2); // to 2.1
    expect(log).toEqual(['a', 'a2', 'b']);
    expect(target.alpha).toBe(0);
    expect(c.now()).toBeCloseTo(2.1);
  });

  it('nearest, inRadius and alive skip dead and spawning enemies', () => {
    const c = new FakeCtx();
    const near = c.spawnEnemy({ x: 10 }), far = c.spawnEnemy({ x: 100 }), spawning = c.spawnEnemy({ x: 5, state: 'spawn' }), dead = c.spawnEnemy({ x: 1, alive: false });
    expect(c.alive()).toEqual([near, far]);
    expect(c.nearest({ x: 0, y: 0 }, 200)).toBe(near);
    expect(c.nearest({ x: 0, y: 0 }, 200, new Set([near.id]))).toBe(far);
    expect(c.nearest({ x: 0, y: 0 }, 5)).toBeNull();
    expect(c.inRadius({ x: 0, y: 0 }, 30)).toEqual([near]);
    void spawning; void dead;
  });

  it('hostile shots: killShot and reflectShot deactivate them', () => {
    const c = new FakeCtx();
    const a = c.spawnHostileShot(), b = c.spawnHostileShot();
    c.killShot(a);
    c.reflectShot(b, 1.5);
    expect(c.enemyShots()).toEqual([]);
    expect(c.callsOf('reflectShot')[0].mult).toBe(1.5);
  });
});
