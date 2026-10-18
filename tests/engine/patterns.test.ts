import { describe, expect, it } from 'vitest';
import { ITEMS, WEAPON_IDS } from '../../src/data/items';
import { degToRad } from '../../src/engine/patterns/common';
import { PATTERNS, stepArsenal, stepWeapons, weaponRt, emitFire, collectLooks, removePuddle, spawnFirePool } from '../../src/engine/patterns';
import { FakeArsenal, StubSprite } from '../../src/engine/patterns/fakeHost';
import { wrapAngle, weaponDamageMult, weaponCooldownMult, weaponBase, weaponTiers } from '../../src/engine/define';
import { contentItem } from '../../src/engine/registry';
import { combatRng } from '../../src/systems/rng';
import type { WeaponPattern } from '../../src/types';
import { arsenal, at } from '../content/helpers';

// The pattern module (src/engine/patterns), run headless through the FakeArsenal: the weapon loop, the pools the patterns share, the
// projectile flight, the looks and the entry points combos call. Per-pattern behaviour of each weapon is in tests/content/items/<weapon>.test.ts.

const ALL: WeaponPattern[] = ['toast', 'burst', 'sweep', 'pulse', 'aura', 'zap', 'ricochet', 'puddle', 'laser', 'mortar', 'cone', 'popcorn'];

describe('the pattern table', () => {
  it('has exactly one pattern per WeaponPattern, keyed by its id', () => {
    expect(Object.keys(PATTERNS).sort()).toEqual([...ALL].sort());
    for (const [key, p] of Object.entries(PATTERNS)) expect(p.id).toBe(key);
  });

  it('every weapon content file names a pattern the table has, and every pattern has a weapon', () => {
    const used = WEAPON_IDS.map((id) => ITEMS[id].weapon!.pattern);
    for (const p of used) expect(PATTERNS[p], p).toBeDefined();
    expect([...new Set(used)].sort()).toEqual([...ALL].sort());
    expect(WEAPON_IDS).toHaveLength(13);
  });

  it('only the puddle is blind, burst/pulse/aura tick every frame, puddle and mortar keep things in the world', () => {
    expect(ALL.filter((p) => PATTERNS[p].blind)).toEqual(['puddle']);
    expect(ALL.filter((p) => PATTERNS[p].tick).sort()).toEqual(['aura', 'burst', 'pulse']);
    expect(ALL.filter((p) => PATTERNS[p].update).sort()).toEqual(['mortar', 'puddle']);
  });
});

describe('weapon runtime', () => {
  it('staggers the cooldowns (0.4 s + 0.17 s per weapon) and resolves the tune at the weapon tier', () => {
    const { a } = arsenal([at('toaster'), at('mop', 2, { near: [] })]);
    expect(a.weapons.map((w) => w.cd)).toEqual([0.4, 0.4 + 0.17]);
    expect(a.weapons[1].tune).toMatchObject({ slowPct: 0.25, slowDuration: 0.5, damage: 3 * 1.5, range: 60 });
    expect(a.weapons[0].base).toBe(ITEMS.toaster.weapon);
    expect(a.weapons.map((w) => w.electrical)).toEqual([true, false]);
  });

  it('weaponRt builds the same runtime the arsenal uses', () => {
    const { b } = arsenal([at('toaster')]);
    const rt = weaponRt(b.weapons[0], 3, null, contentItem('toaster')!);
    expect(rt).toMatchObject({ cd: 0.4 + 3 * 0.17, burstLeft: 0, burstT: 0, blades: null, electrical: true });
  });
});

describe('stepWeapons', () => {
  it('fires when the cooldown ran out and an enemy is in range: cooldown reset, recoil, nothing earlier', () => {
    const { a, fake, b } = arsenal([at('toaster')]);
    fake.spawnEnemy({ x: 300 });
    a.step(0.3);
    expect(a.spawned).toHaveLength(0);
    a.step(0.15);
    expect(a.spawned).toHaveLength(1);
    expect(a.weapons[0].cd).toBe(b.weapons[0].cooldown);
    expect(a.recoils).toEqual(['u0']);
  });

  it('with no enemy in range it retries in 0.05 s, without recoil', () => {
    const { a, fake } = arsenal([at('toaster')]);
    fake.spawnEnemy({ x: 900 }); // out of the 455 range
    a.step(0.5);
    expect(a.weapons[0].cd).toBe(0.05);
    expect(a.recoils).toEqual([]);
    fake.enemies[0].x = 300;
    a.step(0.05);
    expect(a.spawned).toHaveLength(1);
  });

  it('keeps cooling down while not firing (shop / dead goblin), but never fires', () => {
    const { a, fake } = arsenal([at('toaster')]);
    fake.spawnEnemy({ x: 300 });
    a.run(20, 0.1, false);
    expect(a.spawned).toHaveLength(0);
    expect(a.weapons[0].cd).toBeLessThan(0);
    a.step(0.1, true);
    expect(a.spawned).toHaveLength(1); // fires the moment the fight is on
  });

  it('a blind pattern (the Mop) drops its puddle with nobody around and does not recoil', () => {
    const { a } = arsenal([at('mop')]);
    a.step(0.5);
    expect(a.puddles).toHaveLength(1);
    expect(a.recoils).toEqual([]);
    expect(a.weapons[0].cd).toBe(1.6);
  });

  it('electrical weapons cycle faster with the department rate, the others do not', () => {
    const { a } = arsenal([at('toaster'), at('pan', 1, { near: [] })]);
    a.electricalRate = 2;
    a.step(0.1);
    expect(a.weapons[0].cd).toBeCloseTo(0.2); // 0.4 - 0.1 x 2
    expect(a.weapons[1].cd).toBeCloseTo(0.4 + 0.17 - 0.1); // the pan is not electrical
  });

  it('runs a burst\'s remaining nails even while not firing (the legacy loop did not gate them)', () => {
    const { a, fake } = arsenal([at('nailgun')]);
    fake.spawnEnemy({ x: 300 });
    a.step(0.5); // starts the burst: burstLeft = 3, the first nail goes out on this frame's tick? no: next frame
    a.step(0.05, false);
    a.step(0.1, false);
    a.step(0.1, false);
    expect(a.spawned.length).toBeGreaterThanOrEqual(2);
  });
});

describe('stepArsenal order', () => {
  it('advances the arsenal clock first, then weapons, shots, the host\'s enemy shots, and the world (puddles before pots)', () => {
    const { a } = arsenal([at('mop')]);
    const order: string[] = [];
    stepArsenal(a, 0.1, true, () => order.push('enemyShots'));
    expect(a.time).toBeCloseTo(0.1);
    expect(order).toEqual(['enemyShots']);
    const src = import.meta.glob('../../src/engine/patterns/index.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const code = Object.values(src)[0];
    const body = code.slice(code.indexOf('export function stepArsenal'));
    const idx = ['h.time += dt', 'stepWeapons(h, dt, firing)', 'updateShots(h, dt)', 'enemyShots?.()', 'for (const p of WORLD)'].map((s) => body.indexOf(s));
    expect(idx.every((i) => i > 0)).toBe(true);
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
    expect(code).toMatch(/WORLD: readonly Pattern\[\] = \[puddle, mortar\]/);
  });

  it('stepWeapons alone does not move shots or tick puddles', () => {
    const { a, fake } = arsenal([at('toaster')]);
    fake.spawnEnemy({ x: 300 });
    stepWeapons(a, 0.5, true);
    const s = a.spawned[0].shot;
    const x = s.x;
    stepWeapons(a, 0.1, true);
    expect(s.x).toBe(x);
  });
});

describe('repeat (Multipack on sweeps, cones and mortars)', () => {
  it('attacks once now and (count - 1) more times, repeatDelay apart, only while the aisle is fought', () => {
    const { a, fake } = arsenal([at('pan'), at('multipack')]);
    expect(a.weapons[0].stats.count).toBe(2);
    fake.spawnEnemy({ x: 100, hp: 1000 });
    a.step(0.5);
    expect(fake.callsOf('damage')).toHaveLength(1);
    expect(fake.callsOf('delay').map((c) => c.seconds)).toEqual([0.18]);
    fake.advance(0.2);
    expect(fake.callsOf('damage')).toHaveLength(2);
    // the aisle ended before the second swing
    const b = arsenal([at('pan'), at('multipack')]);
    b.fake.spawnEnemy({ x: 100, hp: 1000 });
    b.a.step(0.5);
    b.fake.active = false;
    b.fake.advance(0.2);
    expect(b.fake.callsOf('damage')).toHaveLength(1);
  });
});

describe('pattern:fire (emitFire)', () => {
  it('allocates and emits nothing while nobody listens, and reports a handler\'s `handled`', () => {
    const { a, b } = arsenal([at('toaster')]);
    expect(emitFire(a, b.weapons[0], 1, 2, 0.5, true)).toBe(false);
    a.fake.attach({ ...a.fake.hooks, 'pattern:fire': [{ id: 'x', order: 0, c: {} as never, fn: (ev: { handled: boolean }) => { ev.handled = true; } }], emit(name: string, ev: unknown) { (this as never as Record<string, { fn: (e: unknown) => void }[]>)[name].forEach((h) => h.fn(ev)); } } as never);
    expect(emitFire(a, b.weapons[0], 1, 2, 0.5, true)).toBe(true);
  });

  it('the toast, nail and cap patterns all ask the hooks, per projectile, and skip the default shot when handled', () => {
    for (const [weapon, shots] of [['toaster', 1], ['nailgun', 3], ['fizz', 1]] as const) {
      const { a, fake } = arsenal([at(weapon)]);
      const seen: { first: boolean; angle: number }[] = [];
      fake.attach({
        ...fake.hooks,
        'pattern:fire': [{ id: 't', order: 0, c: {} as never, fn: (ev: { first: boolean; angle: number; handled: boolean }) => { seen.push({ first: ev.first, angle: ev.angle }); ev.handled = true; } }],
        emit(name: string, ev: unknown) { if (name === 'pattern:fire') (this as unknown as Record<string, { fn: (e: never) => void }[]>)['pattern:fire'].forEach((h) => h.fn(ev as never)); },
      } as never);
      fake.spawnEnemy({ x: 300 });
      a.run(10, 0.1);
      expect(seen.length, weapon).toBeGreaterThanOrEqual(shots);
      expect(seen[0].first, weapon).toBe(true);
      expect(a.spawned.filter((s) => s.stats?.type === weapon), weapon).toHaveLength(0);
    }
  });
});

describe('projectile flight', () => {
  const shotAt = (a: FakeArsenal, x: number, y: number, vx: number, vy: number, over: { maxHits?: number; key?: string } = {}) => {
    const stats = a.weapons[0].stats;
    const s = a.spawn(over.key ?? 'proj_toast', x, y, Math.atan2(vy, vx), Math.hypot(vx, vy), 5, 7, stats, over.maxHits ?? 1)!;
    return s;
  };

  it('moves a shot by velocity x dt, drops its life, and kills it past the arena bounds or when its life runs out', () => {
    const { a } = arsenal([at('toaster')]);
    const s = shotAt(a, 100, 300, 200, 0);
    a.sc.hooks; // eslint-disable-line @typescript-eslint/no-unused-expressions
    stepArsenal(a, 0.5, false);
    expect(s.x).toBe(200);
    expect(s.life).toBe(4.5);
    const far = shotAt(a, 1255, 300, 200, 0);
    stepArsenal(a, 0.1, false);
    expect(far.active).toBe(false);
    const dying = shotAt(a, 100, 300, 0, 0);
    dying.life = 0.05;
    stepArsenal(a, 0.1, false);
    expect(dying.active).toBe(false);
  });

  it('damages an enemy it touches once (pierce 0 ends it), with the shot\'s damage and a push along its heading', () => {
    const { a, fake } = arsenal([at('toaster')]);
    const e = fake.spawnEnemy({ x: 135, y: 300, hp: 100 });
    shotAt(a, 100, 300, 200, 0);
    stepArsenal(a, 0.1, false);
    const [hit] = fake.callsOf('damage');
    expect(hit).toMatchObject({ enemy: e.id, dmg: 7, opts: { kb: 60, kbX: 1, kbY: 0 } });
    expect(a.shots[0].active).toBe(false);
  });

  it('a piercing shot hits each enemy once and flies on', () => {
    const { a, fake } = arsenal([at('toaster')]);
    fake.spawnEnemy({ x: 135, y: 300, hp: 100 });
    fake.spawnEnemy({ x: 200, y: 300, hp: 100 });
    const s = shotAt(a, 100, 300, 200, 0, { maxHits: 3 });
    for (let i = 0; i < 10; i++) stepArsenal(a, 0.05, false);
    expect(fake.callsOf('damage')).toHaveLength(2);
    expect(s.active).toBe(true);
  });

  it('a Cereal Box front eats the shot (and blocks the hit) until it is soggy', () => {
    const { a, fake } = arsenal([at('toaster')], { player: { x: 0, y: 300 } }); // the front faces the goblin, the shot flies at it head-on
    const e = fake.spawnEnemy({ x: 135, y: 300, hp: 100, def: { shield: true } as never });
    shotAt(a, 100, 300, 200, 0);
    stepArsenal(a, 0.1, false);
    expect(fake.callsOf('damage')).toHaveLength(0);
    expect((e as { shieldBlocked?: number }).shieldBlocked).toBe(1);
    expect(a.shots[0].active).toBe(false);
    expect(a.sounds).toContain('cap_ping@0.6');
  });

  it('emits pattern:shotHit right after the damage and before the pierce check, with the shot and enemy', () => {
    const { a, fake } = arsenal([at('toaster')]);
    const log: string[] = [];
    const e = fake.spawnEnemy({ x: 135, y: 300, hp: 100 });
    fake.attach({
      ...fake.hooks,
      'pattern:shotHit': [{ id: 't', order: 0, c: {} as never, fn: (ev: { enemy: unknown; shot: { active: boolean } }) => { log.push(`hit:${ev.enemy === e}:${fake.callsOf('damage').length}:${ev.shot.active}`); } }],
      emit(name: string, ev: unknown) { if (name === 'pattern:shotHit') (this as unknown as Record<string, { fn: (e: never) => void }[]>)['pattern:shotHit'].forEach((h) => h.fn(ev as never)); },
    } as never);
    shotAt(a, 100, 300, 200, 0);
    stepArsenal(a, 0.1, false);
    expect(log).toEqual(['hit:true:1:true']); // damaged already, not yet killed by the spent check
    expect(a.shots[0].active).toBe(false);
  });

  it('a cap bounces to the next enemy it has not hit: turned toward it at the same speed, life topped up, pattern:bounce first', () => {
    const { a, fake } = arsenal([at('fizz')]);
    fake.spawnEnemy({ x: 150, y: 300, hp: 100 });
    const second = fake.spawnEnemy({ x: 150, y: 450, hp: 100 });
    const seen: unknown[] = [];
    fake.attach({
      ...fake.hooks,
      'pattern:bounce': [{ id: 't', order: 0, c: {} as never, fn: (ev: { next: unknown; shot: { vx: number } }) => { seen.push([ev.next === second, ev.shot.vx]); } }],
      emit(name: string, ev: unknown) { if (name === 'pattern:bounce') (this as unknown as Record<string, { fn: (e: never) => void }[]>)['pattern:bounce'].forEach((h) => h.fn(ev as never)); },
    } as never);
    const s = shotAt(a, 110, 300, 200, 0, { maxHits: 3, key: 'proj_cap' });
    s.life = 0.2;
    stepArsenal(a, 0.1, false);
    expect(seen).toEqual([[true, 200]]); // emitted before the redirect
    const sp = Math.hypot(s.vx, s.vy);
    expect(sp).toBeCloseTo(200);
    expect(Math.atan2(s.vy, s.vx)).toBeCloseTo(Math.atan2(second.y - s.y, second.x - s.x));
    expect(s.life).toBeGreaterThanOrEqual(0.6);
    expect(a.sounds.some((x) => x.startsWith('cap_ping@1.'))).toBe(true);
  });

  it('a shot with homing set lets pattern:shotMove steer it before it moves, at the same speed', () => {
    const { a, fake } = arsenal([at('nailgun')]);
    const s = shotAt(a, 100, 300, 200, 0, { key: 'proj_nail' });
    s.homing = true;
    const seen: string[] = [];
    fake.attach({
      ...fake.hooks,
      'pattern:shotMove': [{ id: 't', order: 0, c: {} as never, fn: (ev: { shot: { x: number }; dt: number; hits: Set<number>; steer(a: number): void }) => { seen.push(`${ev.shot.x}:${ev.dt}:${ev.hits.size}`); ev.steer(Math.PI / 2); } }],
      emit(name: string, ev: unknown) { if (name === 'pattern:shotMove') (this as unknown as Record<string, { fn: (e: never) => void }[]>)['pattern:shotMove'].forEach((h) => h.fn(ev as never)); },
    } as never);
    stepArsenal(a, 0.1, false);
    expect(seen).toEqual(['100:0.1:0']); // before the move
    expect(s.vx).toBeCloseTo(0);
    expect(s.vy).toBeCloseTo(200);
    expect(s.x).toBeCloseTo(100);
    expect(s.y).toBeCloseTo(320);
    expect((s.img as StubSprite).rotation).toBeCloseTo(Math.PI / 2);
  });

  it('a shot that is not homing never reaches pattern:shotMove', () => {
    const { a, fake } = arsenal([at('nailgun')]);
    shotAt(a, 100, 300, 200, 0, { key: 'proj_nail' });
    let n = 0;
    fake.attach({ ...fake.hooks, 'pattern:shotMove': [{ id: 't', order: 0, c: {} as never, fn: () => { n++; } }], emit() { n++; } } as never);
    stepArsenal(a, 0.1, false);
    expect(n).toBe(0);
  });

  it('draws the weapon\'s look trail for every live shot after it moved', () => {
    const { a } = arsenal([at('toaster')]);
    const seen: number[] = [];
    a.looks.set(a.weapons[0].stats.uid, { trail: (s) => { seen.push(s.x); } });
    shotAt(a, 100, 300, 200, 0);
    stepArsenal(a, 0.1, false);
    expect(seen).toEqual([120]);
  });
});

describe('looks (pattern:look)', () => {
  it('collectLooks asks the hooks once per weapon and keeps only the weapons somebody restyled', () => {
    const { a, fake, b } = arsenal([at('toaster'), at('pan', 1, { near: [] })]);
    let asked = 0;
    fake.attach({ ...fake.hooks, 'pattern:look': [{ id: 't', order: 0, c: {} as never, fn: (ev: { stats: { type: string }; look: { soundRate?: number } }) => { asked++; if (ev.stats.type === 'pan') ev.look.soundRate = 2; } }], emit(name: string, ev: unknown) { if (name === 'pattern:look') (this as unknown as Record<string, { fn: (e: never) => void }[]>)['pattern:look'].forEach((h) => h.fn(ev as never)); } } as never);
    collectLooks(fake.hooks, a.weapons, a.looks);
    expect(asked).toBe(b.weapons.length);
    expect([...a.looks.keys()]).toEqual([b.weapons[1].uid]);
    collectLooks(fake.hooks, a.weapons, a.looks); // asking again does not pile up
    expect(a.looks.size).toBe(1);
  });

  it('with no hook it clears the map and asks nobody', () => {
    const { a } = arsenal([at('toaster')]);
    a.looks.set('x', {});
    a.applyLooks();
    expect(a.looks.size).toBe(0);
  });
});

describe('entry points combos call', () => {
  it('spawnFirePool needs a burning weapon, replaces the oldest of 14, and burns at least as hard as the weapon\'s own fire', () => {
    const { a, b } = arsenal([at('mop'), at('fuel')]);
    const st = b.weapons[0];
    expect(st.burn).not.toBeNull();
    const tune = { dps: 1, duration: 1, tick: 0.5 };
    for (let i = 0; i < 16; i++) spawnFirePool(a, i, 0, 40, 3, st, tune);
    expect(a.puddles).toHaveLength(14);
    expect(a.puddles[0].x).toBe(2);
    expect(a.puddles[0].burn).toEqual({ dps: st.burn!.dps, duration: st.burn!.duration, tick: 0.5 });
    expect(a.puddles[0].burnOnly).toBe(true);
    const none = arsenal([at('mop')]);
    spawnFirePool(none.a, 0, 0, 40, 3, none.b.weapons[0], tune);
    expect(none.a.puddles).toHaveLength(0);
  });

  it('removePuddle destroys the sprite and forgets the puddle', () => {
    const { a, b } = arsenal([at('mop'), at('fuel')]);
    spawnFirePool(a, 0, 0, 40, 3, b.weapons[0], { dps: 1, duration: 1, tick: 0.5 });
    const pd = a.puddles[0];
    removePuddle(a, pd);
    expect(a.puddles).toHaveLength(0);
    expect((pd.img as StubSprite).destroyed).toBe(true);
  });
});

describe('math and tuning helpers', () => {
  it('degToRad and wrapAngle are Phaser\'s formulas', () => {
    expect(degToRad(180)).toBe(Math.PI);
    expect(degToRad(75)).toBe(75 * (Math.PI / 180));
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(7)).toBeCloseTo(7 - 2 * Math.PI);
  });

  it('weaponTiers is the stat times the tier multiplier, to the bit', () => {
    const w = weaponBase({ pattern: 'sweep', damage: 9, cooldown: 1.15, range: 150 });
    expect(w).toMatchObject({ projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
    const t = weaponTiers(w);
    for (const tier of [1, 2, 3]) {
      expect(t.damage[tier - 1]).toBe(9 * weaponDamageMult(tier));
      expect(t.cooldown[tier - 1]).toBe(1.15 * weaponCooldownMult(tier));
    }
  });

  it('the rng stays the arena\'s: a burst draws one number per nail from the fake\'s combat rng, in order', () => {
    const { a, fake } = arsenal([at('nailgun')], { seed: 7 });
    fake.spawnEnemy({ x: 300, hp: 1000 });
    const ref = combatRng(7, 0);
    a.run(30, 0.05);
    const nails = a.spawned.filter((s) => s.key === 'proj_nail');
    expect(nails.length).toBeGreaterThanOrEqual(3);
    // the nose of the cart is at x = 18, the enemy at x = 300 straight ahead: the aim is 0 plus the spread of one draw per nail
    expect(nails.map((s) => s.angle)).toEqual(nails.map(() => Math.atan2(0, 300 - 18) + (ref() - 0.5) * 0.08));
    expect(fake.rng()).toBe(ref()); // and not one draw more
  });
});

describe('guards on the module\'s source', () => {
  const files = import.meta.glob('../../src/engine/patterns/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const entries = Object.entries(files).map(([f, src]) => [f.split('/').pop()!, src] as const);
  const real = entries.filter(([f]) => f !== 'fakeHost.ts');

  it('has the 12 pattern files plus the shared ones', () => {
    expect(entries.map(([f]) => f).sort()).toEqual(['aura.ts', 'burst.ts', 'common.ts', 'cone.ts', 'fakeHost.ts', 'index.ts', 'laser.ts', 'mortar.ts', 'popcorn.ts', 'projectile.ts', 'puddle.ts', 'pulse.ts', 'ricochet.ts', 'sweep.ts', 'toast.ts', 'types.ts', 'zap.ts']);
  });

  it('imports Phaser as a type only (the patterns run headless)', () => {
    for (const [f, src] of entries) expect(src.split('\n').filter((l) => /from 'phaser'/.test(l)).every((l) => l.startsWith('import type')), f).toBe(true);
  });

  it('reads no combo and no recipe: cosmetics come from the look, behavior from hooks', () => {
    for (const [f, src] of real) {
      expect(src, f).not.toMatch(/recipes\.(includes|some)/);
      expect(src, f).not.toMatch(/\b(toastMode|nailstorm|greaseFire|brainFreeze|rayGun)\b/);
      expect(src, f).not.toMatch(/contentComboTune/);
    }
  });

  it('draws gameplay randomness from the arena rng only: Math.random appears just on cosmetic lines, never flow.rng', () => {
    const cosmetic = /\bfx\.|\bplay\(|\.sound\(|animT|rotation:/;
    for (const [f, src] of real) {
      expect(src, f).not.toMatch(/flow\.rng/);
      const bad = src.split('\n').filter((l) => l.includes('Math.random') && !cosmetic.test(l));
      expect(bad, f).toEqual([]);
    }
  });

  it('the pattern files have no per-weapon branch: they never compare an item type', () => {
    for (const [f, src] of real) expect(src, f).not.toMatch(/\.type\s*[!=]==?\s*'/);
    for (const [f, src] of real) expect(src, f).not.toMatch(/ITEMS\[|data\/items|contentItem/); // the host hands each weapon its content file to weaponRt
  });

  it('the legacy scene file is thin: no pattern code, no combo reads, no per-weapon branch', () => {
    const scene = import.meta.glob('../../src/scenes/weapons.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const src = Object.values(scene)[0];
    expect(src).not.toMatch(/recipes\.(includes|some)|contentComboTune|HOMING|type === '/);
    expect(src.split('\n').length).toBeLessThan(200);
  });

  it('no scene reads the four cosmetic combos any more: Toast Mode, Nailstorm, Grease Fire and Brain Freeze live in their combo files', () => {
    const scenes = import.meta.glob('../../src/scenes/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(scenes).length).toBeGreaterThan(5);
    for (const [f, src] of Object.entries(scenes)) {
      expect(src, f).not.toMatch(/recipes\.(includes|some)\(/);
      expect(src, f).not.toMatch(/'(toastMode|nailstorm|greaseFire|brainFreeze)'/);
    }
  });
});
