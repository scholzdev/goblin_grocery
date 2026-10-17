import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES, ELITE_EXCLUDED, MINI_BOSS, CODEX_ENEMIES } from '../src/data/enemies';
import { DEPARTMENTS, DEPT_TUNING, THEMES } from '../src/data/departments';
import { WAVES, enemyAppears } from '../src/data/waves';
import { WET_STATUS } from '../src/engine/define';
import { applyWet, burnVsWet, isWet, slowVsWet, wetChainBonus, wetElectricMult, wetFreezeChance } from '../src/engine/wet';
import { FakeCtx } from '../src/engine/fakeCtx';
import { enemyT } from '../src/i18n/data';
import { setLang } from '../src/i18n/lang';
import { cleanseAura, cleanseStatus, hasCleansable, newStatus, applyBurn, applyPoison, applyShred, applySlow, applyWeaken } from '../src/systems/combat';
import { applyMark } from '../src/engine/marks';
import { arena, arsenal, at, far } from './content/helpers';
import { seedWhere } from './content/sets/helpers';

// Wet (docs/item-hooks-refactor.md "Wet") and the Sanitizer: the status, what it does to electric, frost and heat, where it comes from, the Sanitizer's cleanse and its spawn gate.

afterEach(() => setLang('en'));

describe('WET_STATUS and the status', () => {
  it('the numbers', () => {
    expect(WET_STATUS).toEqual({ duration: 3, electricMult: 1.2, chainBonus: 1, frostSlowBonus: 0.1, freezeChanceMult: 2, burnDurationMult: 0.5, slowCap: 0.7 });
  });

  it('applyWet refreshes to the later end and never shortens a running one', () => {
    const s = newStatus();
    expect(isWet(s, 0)).toBe(false);
    applyWet(s, 3, 0);
    expect(s.wetUntil).toBe(3);
    applyWet(s, 3, 2);
    expect(s.wetUntil).toBe(5);
    applyWet(s, 1, 3); // would end at 4, the running one ends at 5
    expect(s.wetUntil).toBe(5);
    expect(isWet(s, 4.99)).toBe(true);
    expect(isWet(s, 5)).toBe(false);
  });

  it('ctx.wet defaults to WET_STATUS.duration, logs a call and refreshes (FakeCtx)', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy();
    f.wet(e);
    expect(f.callsOf('wet')).toEqual([{ at: 0, kind: 'wet', enemy: e.id, seconds: 3 }]);
    expect(e.status.wetUntil).toBe(3);
    f.advance(2);
    f.wet(e, 5);
    expect(e.status.wetUntil).toBe(7);
  });

  it('bosses are not immune and there is no affinity scaling of the seconds', () => {
    const f = new FakeCtx();
    const boss = f.spawnEnemy({ def: { behavior: 'boss', weak: { frost: 0.3 } } });
    f.wet(boss, 2);
    expect(boss.status.wetUntil).toBe(2);
  });
});

describe('Wet + electric', () => {
  it('an electric hit on a wet enemy deals x1.2; dry, or wet without the electric tag, is untouched', () => {
    const f = new FakeCtx();
    const dry = f.spawnEnemy({ hp: 1000 }), wet = f.spawnEnemy({ hp: 1000, x: 1000 }), wetHeat = f.spawnEnemy({ hp: 1000, x: 2000 }); // far apart: the Conduct reaction would chain to a neighbor
    f.wet(wet); f.wet(wetHeat);
    f.hit(dry, 10, null, { tags: ['electric'] });
    f.hit(wet, 10, null, { tags: ['electric'] });
    f.hit(wetHeat, 10, null, { tags: ['heat'] });
    expect(1000 - dry.hp).toBeCloseTo(10, 12);
    expect(1000 - wet.hp).toBeCloseTo(12, 12);
    expect(1000 - wetHeat.hp).toBeCloseTo(10, 12);
  });

  it('stops after the Wet ran out', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000 });
    f.wet(e);
    f.advance(3.01);
    f.hit(e, 10, null, { tags: ['electric'] });
    expect(1000 - e.hp).toBeCloseTo(10, 12);
  });

  it('a Blender hit (electric by its element) is x1.2 on a wet enemy', () => {
    const { fake, stats: w } = arena([at('blender')]);
    const dry = fake.spawnEnemy({ hp: 1000 }), wet = fake.spawnEnemy({ hp: 1000, x: 1000 }); // far apart: the Conduct reaction would chain to a neighbor
    fake.wet(wet);
    fake.hit(dry, 10, w);
    fake.hit(wet, 10, w);
    expect((1000 - wet.hp) / (1000 - dry.hp)).toBeCloseTo(1.2, 12);
  });

  it('it sits right after the affinity: a weak electric hit is x(1 + weak) x 1.2', () => {
    const f = new FakeCtx();
    const e = f.spawnReal('soda', { hp: 1000 }); // weak to electric (+30%)
    f.wet(e);
    f.hit(e, 10, null, { tags: ['electric'] });
    expect(1000 - e.hp).toBeCloseTo(10 * 1.3 * 1.2, 12);
  });

  it('pure rule', () => {
    const s = newStatus();
    expect(wetElectricMult(s, ['electric'], 0)).toBe(1);
    applyWet(s, 3, 0);
    expect(wetElectricMult(s, ['electric'], 1)).toBe(1.2);
    expect(wetElectricMult(s, ['electric', 'heat'], 1)).toBe(1.2);
    expect(wetElectricMult(s, ['heat', 'blast'], 1)).toBe(1);
    expect(wetElectricMult(s, [], 1)).toBe(1);
  });

  describe('chain +1 (Electric set arc)', () => {
    const TOASTER = at('toaster');
    const cart = [TOASTER, far('battery'), far('vacuum')]; // Electric L2: 20%, 2 jumps
    const field = (seed: number) => {
      const a = arena(cart, { seed });
      return { ...a, row: [0, 50, 100, 150, 200, 250].map((x) => a.fake.spawnEnemy({ hp: 1000, x, y: 0 })) };
    };
    const lucky = seedWhere((r) => r < 0.2);

    it('a dry origin arcs to 2 enemies, a wet origin to 3', () => {
      const dry = field(lucky);
      dry.fake.hit(dry.row[0], 10, dry.stats);
      expect(dry.fake.callsOf('damage').map((c) => c.enemy)).toEqual([dry.row[1].id, dry.row[2].id]);
      const wet = field(lucky);
      wet.fake.wet(wet.row[0]);
      wet.fake.hit(wet.row[0], 10, wet.stats);
      expect(wet.fake.callsOf('damage').map((c) => c.enemy)).toEqual([wet.row[1].id, wet.row[2].id, wet.row[3].id]);
    });

    it('exactly one extra hop per chain: wet enemies further down the chain add nothing; a wet enemy elsewhere does not count', () => {
      const all = field(lucky);
      for (const e of all.row) all.fake.wet(e);
      all.fake.hit(all.row[0], 10, all.stats);
      expect(all.fake.callsOf('damage').filter((c) => !c.opts.reaction)).toHaveLength(3); // 2 + 1, not 2 + 1 per wet link (the Conduct bursts on the wet enemies are not the chain)
      const elsewhere = field(lucky);
      elsewhere.fake.wet(elsewhere.row[3]); // the origin is dry
      elsewhere.fake.hit(elsewhere.row[0], 10, elsewhere.stats);
      expect(elsewhere.fake.callsOf('damage')).toHaveLength(2);
    });

    it('the extra hop draws no rng (one roll per arc, as before)', () => {
      const dry = field(lucky), wet = field(lucky);
      wet.fake.wet(wet.row[0]);
      dry.fake.hit(dry.row[0], 10, dry.stats);
      wet.fake.hit(wet.row[0], 10, wet.stats);
      expect(wet.fake.rng()).toBe(dry.fake.rng());
    });

    it('pure rule', () => {
      const s = newStatus();
      expect(wetChainBonus(s, 0)).toBe(0);
      applyWet(s, 3, 0);
      expect(wetChainBonus(s, 1)).toBe(1);
      expect(wetChainBonus(s, 3)).toBe(0);
    });
  });

  describe('chain +1 (Microwave zap)', () => {
    // A microwave (chain 0): the toughest in range is struck, then `chain` more links to the closest within 220. Three groceries 200 apart, the first the toughest.
    const zaps = (wetFirst: boolean, wetAll = false) => {
      const { a, fake } = arsenal([at('microwave')]);
      const e1 = fake.spawnEnemy({ hp: 100000, x: 100, y: 0 }), e2 = fake.spawnEnemy({ hp: 90000, x: 300, y: 0 }), e3 = fake.spawnEnemy({ hp: 80000, x: 500, y: 0 });
      if (wetFirst || wetAll) fake.wet(e1);
      if (wetAll) { fake.wet(e2); fake.wet(e3); }
      a.run(60, 0.05); // fires once (2.4 s)
      return [e1, e2, e3].filter((e) => fake.callsOf('damage').some((c) => c.enemy === e.id)).length;
    };
    it('a dry first target: just the strike; a wet first target: one more link, once', () => {
      expect(zaps(false)).toBe(1);
      expect(zaps(true)).toBe(2);
      expect(zaps(false, true)).toBe(2); // all wet, the first one is too: still one extra link
    });
  });
});

describe('Wet + frost', () => {
  it('a slow on a wet enemy gets +10 points, a dry one is untouched; the log keeps what was asked', () => {
    const f = new FakeCtx();
    const dry = f.spawnEnemy(), wet = f.spawnEnemy();
    f.wet(wet);
    f.slow(dry, { pct: 0.35, duration: 1 });
    f.slow(wet, { pct: 0.35, duration: 1 });
    expect(dry.status.slowPct).toBe(0.35);
    expect(wet.status.slowPct).toBeCloseTo(0.45, 12);
    expect(f.callsOf('slow').map((c) => c.slow.pct)).toEqual([0.35, 0.35]);
  });

  it('never past the 0.7 cap, and never lowers a slow that is already above it', () => {
    const s = newStatus();
    applyWet(s, 3, 0);
    expect(slowVsWet(s, { pct: 0.65, duration: 1 }, 0).pct).toBeCloseTo(0.7, 12);
    expect(slowVsWet(s, { pct: 0.7, duration: 1 }, 0).pct).toBe(0.7);
    expect(slowVsWet(s, { pct: 0.8, duration: 1 }, 0).pct).toBe(0.8);
    expect(slowVsWet(s, { pct: 0.25, duration: 1 }, 0).pct).toBeCloseTo(0.35, 12);
    expect(slowVsWet(newStatus(), { pct: 0.65, duration: 1 }, 0).pct).toBe(0.65);
  });

  it('the stats-driven slow of an Ice Pack hit is boosted through the pipeline', () => {
    const { fake, stats: w } = arena([at('fizz'), at('ice'), far('mop'), far('spray')]); // Frost L3 sets the slow to 0.25 + 0.15
    const dry = fake.spawnEnemy({ hp: 1000 }), wet = fake.spawnEnemy({ hp: 1000 });
    fake.wet(wet);
    fake.hit(dry, 3, w);
    fake.hit(wet, 3, w);
    expect(wet.status.slowPct - dry.status.slowPct).toBeCloseTo(0.1, 12);
  });

  describe('freeze chance x2 (Frost L2)', () => {
    const cart = [at('fizz'), at('ice'), far('mop')]; // Frost L2: 10%, 0.5 s on a >= 35% slow
    const run = (seed: number, wet: boolean) => {
      const a = arena(cart, { seed });
      const e = a.fake.spawnEnemy({ hp: 1000 });
      if (wet) a.fake.wet(e);
      a.fake.hit(e, 3, a.stats);
      return a.fake.callsOf('stun').length;
    };
    it('a draw between 10% and 20% freezes only a wet enemy', () => {
      const seed = seedWhere((r) => r >= 0.1 && r < 0.2);
      expect(run(seed, false)).toBe(0);
      expect(run(seed, true)).toBe(1);
    });
    it('a draw under 10% freezes both, one at or over 20% neither', () => {
      const low = seedWhere((r) => r < 0.1), high = seedWhere((r) => r >= 0.2);
      expect([run(low, false), run(low, true)]).toEqual([1, 1]);
      expect([run(high, false), run(high, true)]).toEqual([0, 0]);
    });
    it('pure rule, capped at 1', () => {
      const s = newStatus();
      expect(wetFreezeChance(s, 0.1, 0)).toBe(0.1);
      applyWet(s, 3, 0);
      expect(wetFreezeChance(s, 0.1, 1)).toBe(0.2);
      expect(wetFreezeChance(s, 0.2, 1)).toBe(0.4);
      expect(wetFreezeChance(s, 0.7, 1)).toBe(1);
    });
  });
});

describe('Wet + heat (steam)', () => {
  const burn = { dps: 2.5, duration: 3, tick: 0.5 };

  it('a burn on a wet enemy lasts half as long and dries it; on a dry one it is the full burn', () => {
    const f = new FakeCtx();
    const dry = f.spawnEnemy(), wet = f.spawnEnemy();
    f.wet(wet);
    f.ignite(dry, burn);
    f.ignite(wet, burn);
    expect(dry.status.burnUntil).toBe(3);
    expect(wet.status.burnUntil).toBe(1.5);
    expect(wet.status.burnDps).toBe(2.5); // dps untouched
    expect(isWet(wet.status, 0)).toBe(false);
    expect(f.callsOf('ignite').map((c) => c.burn.duration)).toEqual([3, 3]); // the log keeps what was asked
  });

  it('an existing burn is not touched when the enemy gets wet afterwards, its ticks keep their dps and the Wet stays', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy();
    f.ignite(e, burn);
    f.wet(e);
    expect(e.status.burnUntil).toBe(3);
    expect(e.status.burnDps).toBe(2.5);
    expect(isWet(e.status, 0)).toBe(true);
  });

  it('re-igniting a wet burning enemy dries it but never shortens the running burn', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy();
    f.ignite(e, burn);
    f.wet(e);
    f.ignite(e, burn);
    expect(e.status.burnUntil).toBe(3);
    expect(isWet(e.status, 0)).toBe(false);
  });

  it('a Toaster + Fuel Can hit does it through the pipeline', () => {
    const { fake, stats: w } = arena([at('toaster'), at('fuel')]);
    expect(w.burn).toBeTruthy();
    const dry = fake.spawnEnemy({ hp: 1000 }), wet = fake.spawnEnemy({ hp: 1000 });
    fake.wet(wet);
    fake.hit(dry, 5, w);
    fake.hit(wet, 5, w);
    expect(wet.status.burnUntil).toBeCloseTo(dry.status.burnUntil * WET_STATUS.burnDurationMult, 12);
    expect(isWet(wet.status, 0)).toBe(false);
  });

  it('the heat affinity scales first, then the steam halves (a weak enemy: x1.5 then x0.5)', () => {
    const f = new FakeCtx();
    const e = f.spawnReal('baguette'); // weak to heat
    f.wet(e);
    f.ignite(e, burn);
    expect(e.status.burnUntil).toBeCloseTo(3 * 1.5 * 0.5, 12);
  });

  it('pure rule', () => {
    const s = newStatus();
    const b = { dps: 1, duration: 4, tick: 0.5 };
    expect(burnVsWet(s, b, 0)).toBe(b);
    applyWet(s, 3, 0);
    expect(burnVsWet(s, b, 1)).toEqual({ dps: 1, duration: 2, tick: 0.5 });
    expect(s.wetUntil).toBe(0);
  });
});

describe('where Wet comes from', () => {
  it('the Mop puddle soaks every enemy inside, every tick, for 3 s', () => {
    const { a, fake } = arsenal([at('mop', 3)]);
    const inside = fake.spawnEnemy({ x: -40, y: 4, hp: 100000 }), outside = fake.spawnEnemy({ x: -40, y: 50, hp: 100000 });
    expect(a.puddles).toHaveLength(0);
    a.run(15, 0.05);
    expect(isWet(inside.status, fake.time)).toBe(true);
    expect(inside.status.wetUntil).toBeGreaterThan(fake.time + 2.5);
    expect(isWet(outside.status, fake.time)).toBe(false);
  });

  it('the Spray Bottle soaks what its cone hits; the Leaf Blower (the same cone) does not', () => {
    const spray = arsenal([at('spray')]);
    const hit = spray.fake.spawnEnemy({ x: 60, y: 0, hp: 100000 }), behind = spray.fake.spawnEnemy({ x: -300, y: 0, hp: 100000 });
    spray.a.run(20, 0.05);
    expect(spray.fake.callsOf('damage').some((c) => c.enemy === hit.id)).toBe(true);
    expect(isWet(hit.status, spray.fake.time)).toBe(true);
    expect(isWet(behind.status, spray.fake.time)).toBe(false);
    const leaf = arsenal([at('leafblower')]);
    const e = leaf.fake.spawnEnemy({ x: 60, y: 0, hp: 100000 });
    leaf.a.run(30, 0.05);
    expect(leaf.fake.callsOf('damage').some((c) => c.enemy === e.id)).toBe(true);
    expect(isWet(e.status, leaf.fake.time)).toBe(false);
  });

  it('the cone soaks BEFORE it damages, so a frost slow or electric tag of that very hit already reacts (wired by source)', () => {
    const cone = import.meta.glob('../src/engine/patterns/cone.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const text = Object.values(cone)[0];
    expect(text.indexOf('applyWet(e.status, w.tune.wet')).toBeGreaterThan(-1);
    expect(text.indexOf('applyWet(e.status, w.tune.wet')).toBeLessThan(text.indexOf('sc.damageEnemy(e, st.damage'));
  });

  it('the wet-floor event spot soaks enemies standing in it (wired by source, next to its slow)', () => {
    const SRC = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const src = (p: string) => SRC[Object.keys(SRC).find((k) => k.endsWith(`/${p}`))!];
    const ev = src('scenes/events.ts');
    expect(ev).toContain('applyWet(e.status, WET_STATUS.duration, now)');
    expect(ev.indexOf('applySlow(e.status, slowFor(e.def, { pct: WET.enemySlow')).toBeLessThan(ev.indexOf('applyWet(e.status'));
  });

  it('the pipeline slot and both ctx implementations are wired (source guards)', () => {
    const SRC = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const src = (p: string) => SRC[Object.keys(SRC).find((k) => k.endsWith(`/${p}`))!];
    const scene = src('scenes/ArenaScene.ts');
    expect(scene).toContain('dmg *= wetElectricMult(e.status, tags, now);');
    expect(scene.indexOf('dmg *= aff;')).toBeLessThan(scene.indexOf('dmg *= wetElectricMult'));
    expect(scene.indexOf('dmg *= wetElectricMult')).toBeLessThan(scene.indexOf('dmg = markedDamage('));
    expect(src('engine/fakeCtx.ts')).toContain('dmg *= wetElectricMult(e.status, tags, now);');
    expect(src('scenes/phaserCtx.ts')).toContain('applyBurn(e.status, burnVsWet(e.status,');
    expect(src('scenes/phaserCtx.ts')).toContain('applySlow(e.status, slowVsWet(e.status,');
    expect(src('scenes/phaserCtx.ts')).toContain('applyWet(e.status, seconds, this.now())');
    expect(src('engine/fakeCtx.ts')).toContain('applyBurn(e.status, burnVsWet(e.status,');
    expect(src('engine/fakeCtx.ts')).toContain('applySlow(e.status, slowVsWet(e.status,');
    expect(src('engine/patterns/puddle.ts')).toContain('applyWet(e.status, pd.wet, now)');
    expect(scene).toContain('isWet(e.status, t)'); // the droplets
  });
});

describe('Hand Sanitizer: the cleanse', () => {
  const at_ = (x: number, y = 0, extra: Record<string, unknown> = {}) => ({ x, y, alive: true, state: 'walk', status: newStatus(), def: { radius: 20 }, markedUntil: undefined as number | undefined, ...extra });
  const dirty = (o: ReturnType<typeof at_>, now = 0) => {
    applyBurn(o.status, { dps: 2, duration: 5, tick: 0.5 }, now);
    applyPoison(o.status, 2, 5, now);
    applyShred(o.status, 2, 5, now);
    applyWet(o.status, 5, now);
    applyWeaken(o.status, 0.3, 5, now);
    applySlow(o.status, { pct: 0.4, duration: 5 }, now);
    o.markedUntil = now + 5;
    return o;
  };

  it('removes exactly burn, poison, shred, wet and weaken; slow and mark stay', () => {
    const o = dirty(at_(0));
    expect(hasCleansable(o.status, 0)).toBe(true);
    cleanseStatus(o.status);
    expect(hasCleansable(o.status, 0)).toBe(false);
    expect(o.status).toMatchObject({ burnDps: 0, burnUntil: 0, poisonDps: 0, poisonUntil: 0, shredStacks: 0, shredUntil: 0, wetUntil: 0, weakenPct: 0, weakenUntil: 0 });
    expect(o.status.slowPct).toBe(0.4);
    expect(o.status.slowUntil).toBe(5);
    expect(o.markedUntil).toBe(5);
  });

  it('slow and mark alone are nothing to clean', () => {
    const o = at_(0);
    applySlow(o.status, { pct: 0.4, duration: 5 }, 0);
    expect(hasCleansable(o.status, 0)).toBe(false);
    expect(cleanseAura(o, [o], 120, 0)).toEqual([]);
    expect(o.status.slowPct).toBe(0.4);
  });

  it('cleanses itself and everyone within radius + their own radius, nobody beyond; returns who lost something', () => {
    const san = dirty(at_(0)), edge = dirty(at_(140)), out = dirty(at_(141)), clean = at_(50);
    const hit = cleanseAura(san, [san, edge, out, clean], 120, 0);
    expect(hit).toEqual([san, edge]); // 120 + the ally's radius 20 = 140 is in, 141 is out; the clean one has nothing to lose
    expect(hasCleansable(out.status, 0)).toBe(true);
    expect(hasCleansable(edge.status, 0)).toBe(false);
  });

  it('skips the dead, the spawning and the dying', () => {
    const san = at_(0), dead = dirty(at_(10, 0, { alive: false })), spawning = dirty(at_(10, 0, { state: 'spawn' })), dying = dirty(at_(10, 0, { state: 'dying' }));
    expect(cleanseAura(san, [san, dead, spawning, dying], 120, 0)).toEqual([]);
    expect(hasCleansable(dead.status, 0)).toBe(true);
  });

  it('is deterministic: the same group gives the same result twice, with no rng involved', () => {
    const run = () => { const a = dirty(at_(0)), b = dirty(at_(60)), c = dirty(at_(300)); cleanseAura(a, [a, b, c], 120, 0); return [a, b, c].map((o) => hasCleansable(o.status, 0)); };
    expect(run()).toEqual([false, false, true]);
    expect(run()).toEqual([false, false, true]);
    expect(cleanseAura.length).toBe(4); // (src, all, radius, now): no rng parameter
  });

  it('a Sanitizer burning in its own bunch cleans itself too (and the real FakeCtx enemies satisfy the type)', () => {
    const f = new FakeCtx();
    const san = f.spawnReal('sanitizer'), milk = f.spawnReal('milk', { x: 60 });
    f.ignite(milk, { dps: 2, duration: 5, tick: 0.5 });
    f.shred(san, 2);
    f.wet(milk);
    cleanseAura(san, f.enemies, ENEMIES.sanitizer.tune.cleanseRadius, f.time);
    expect(hasCleansable(san.status, f.time)).toBe(false);
    expect(hasCleansable(milk.status, f.time)).toBe(false);
  });

  it('the AI ticks it every cleanseInterval (1 s) whatever its state, and keeps the remainder (wired by source)', () => {
    const SRC = import.meta.glob('../src/scenes/enemies.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const t = Object.values(SRC)[0];
    expect(ENEMIES.sanitizer.tune).toEqual({ cleanseRadius: 120, cleanseInterval: 1 });
    expect(t).toContain("if (d.id === 'sanitizer' && e.state !== 'spawn' && (e.auxT -= dt) <= 0) sanitize(scene, e, now);");
    expect(t).toContain('e.auxT += SANITIZER.cleanseInterval;');
    expect(t).toContain('cleanseAura(e, scene.enemies, SANITIZER.cleanseRadius, now)');
    expect(t.indexOf("d.id === 'sanitizer' && e.state")).toBeLessThan(t.indexOf('if (e.dummy?.still)')); // before the state switch: a stun does not stop it
  });
});

describe('Hand Sanitizer: spawning and content', () => {
  it('appears from aisle 3, never in aisles 1 and 2 or the boss aisle', () => {
    const aisles = WAVES.filter((w) => (w.mix.sanitizer ?? 0) > 0).map((w) => w.index);
    expect(aisles).toEqual([3, 4, 5, 6, 7]);
    expect(enemyAppears('sanitizer').first).toBe(3);
    for (const w of WAVES.filter((x) => x.index < 3 || x.boss)) expect(w.mix.sanitizer, `aisle ${w.index}`).toBeUndefined();
  });

  it('is last in each mix it is in (earlier-aisle spawn sequences are untouched) and low-weight (under 10% of the mix)', () => {
    for (const w of WAVES.filter((x) => x.mix.sanitizer)) {
      const keys = Object.keys(w.mix);
      expect(keys[keys.length - 1], `aisle ${w.index}`).toBe('sanitizer');
      const sum = Object.values(w.mix).reduce((a, b) => a + b, 0);
      expect(w.mix.sanitizer! / sum, `aisle ${w.index}`).toBeLessThan(0.1);
    }
    expect(WAVES.map((w) => w.mix.sanitizer ?? 0)).toEqual([0, 0, 0.35, 0.4, 0.5, 0.5, 0.6, 0]);
  });

  it('spawns at its wave weight in every theme (a basic: no off-theme cut, no favour)', () => {
    expect(DEPT_TUNING.basics).toContain('sanitizer');
    for (const t of THEMES) expect(DEPARTMENTS[t].mix.sanitizer, t).toBeUndefined();
    expect(enemyAppears('sanitizer').depts).toEqual([]);
  });

  it('can be an elite base but never a mid-shift boss', () => {
    expect(ELITE_EXCLUDED).not.toContain('sanitizer');
    for (const v of MINI_BOSS.variants) expect(Object.values(v.byTheme)).not.toContain('sanitizer');
  });

  it('is in the codex once, between the aisle-3 enemies and the spitter', () => {
    expect(CODEX_ENEMIES.filter((id) => id === 'sanitizer')).toHaveLength(1);
    expect(CODEX_ENEMIES.indexOf('sanitizer')).toBeGreaterThan(CODEX_ENEMIES.indexOf('gum'));
    expect(CODEX_ENEMIES.indexOf('sanitizer')).toBeLessThan(CODEX_ENEMIES.indexOf('spitter'));
  });

  it('text, EN and DE, explains the cleanse and renders its numbers', () => {
    expect(enemyT('sanitizer')).toEqual({
      name: 'Hand Sanitizer',
      blurb: 'Plods along and scrubs the crowd clean every 1 s: burn, poison, shred, wet and weaken wash off everything within 120, itself included. Slow, stun and marks stay. Pop it first.',
    });
    setLang('de');
    expect(enemyT('sanitizer')).toEqual({
      name: 'Desinfektionsmittel',
      blurb: 'Trottet heran und putzt die Meute alle 1 s sauber: Brand, Gift, Aufreißen, Nässe und Schwächung verschwinden von allem im Umkreis von 120, auch von ihm selbst. Verlangsamung, Betäubung und Markierungen bleiben. Zuerst ausschalten.',
    });
  });
});

describe('applyMark stays untouched by the cleanse (the mark is not a status of StatusFx)', () => {
  it('a marked enemy keeps the mark after a cleanse', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy();
    applyMark(e, 0, 4);
    cleanseStatus(e.status);
    expect(e.markedUntil).toBe(4);
  });
});
