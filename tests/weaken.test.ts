import { describe, expect, it } from 'vitest';
import { ENEMIES, miniBossDef, MINI_BOSS } from '../src/data/enemies';
import { WEAKEN } from '../src/engine/define';
import { FakeCtx } from '../src/engine/fakeCtx';
import { setLang } from '../src/i18n/lang';
import { applyWeaken, armorDamage, hitArmor, newStatus, shreddedArmorDamage, weakenedDamage, weakenMult } from '../src/systems/combat';
import { affinityRowsHtml } from '../src/ui/affinity';

// Weaken (docs/item-hooks-refactor.md "Weaken") and the armor pass: the status, the damage rule the scene applies at the source, the wiring, the new armor values.

describe('WEAKEN constants', () => {
  it('the percentage is capped at 50%', () => {
    expect(WEAKEN).toEqual({ cap: 0.5 });
  });
});

describe('applyWeaken', () => {
  it('while it runs the stronger percentage wins (a weaker one never lowers it)', () => {
    const s = newStatus();
    applyWeaken(s, 0.2, 3, 0);
    applyWeaken(s, 0.1, 3, 1);
    expect(s.weakenPct).toBe(0.2);
    applyWeaken(s, 0.3, 3, 1.5);
    expect(s.weakenPct).toBe(0.3);
    expect(weakenMult(s, 2)).toBeCloseTo(0.7, 12);
  });

  it('refresh: the end is the later of the two, a shorter application never cuts a running one', () => {
    const s = newStatus();
    applyWeaken(s, 0.2, 3, 0);
    expect(s.weakenUntil).toBe(3);
    applyWeaken(s, 0.2, 3, 2);
    expect(s.weakenUntil).toBe(5);
    applyWeaken(s, 0.1, 1, 3); // would end at 4, the running one ends at 5
    expect(s.weakenUntil).toBe(5);
  });

  it('expiry: nothing counts after the end, and a new application replaces the percentage (even a lower one)', () => {
    const s = newStatus();
    applyWeaken(s, 0.4, 2, 0);
    expect(weakenMult(s, 1.9)).toBeCloseTo(0.6, 12);
    expect(weakenMult(s, 2)).toBe(1);
    applyWeaken(s, 0.15, 3, 5);
    expect(s.weakenPct).toBe(0.15);
    expect(s.weakenUntil).toBe(8);
    expect(weakenMult(s, 5)).toBeCloseTo(0.85, 12);
  });

  it('the percentage is capped at WEAKEN.cap, whatever the source asks for', () => {
    const s = newStatus();
    applyWeaken(s, 0.9, 3, 0);
    expect(s.weakenPct).toBe(WEAKEN.cap);
    expect(weakenMult(s, 0)).toBe(0.5);
    applyWeaken(s, 0.45, 3, 1);
    applyWeaken(s, 0.8, 3, 1);
    expect(s.weakenPct).toBe(WEAKEN.cap);
    const t = newStatus();
    applyWeaken(t, 0.7, 3, 0); // fresh application above the cap
    expect(t.weakenPct).toBe(WEAKEN.cap);
  });

  it('a fresh enemy is not weakened', () => {
    expect(weakenMult(newStatus(), 0)).toBe(1);
    expect(weakenMult(newStatus(), 100)).toBe(1);
  });
});

describe('weakenedDamage: the damage an enemy deals to the player', () => {
  const enemy = (pct = 0, until = 0) => { const status = newStatus(); if (pct) applyWeaken(status, pct, until, 0); return { status }; };

  it('unweakened it is the damage untouched (whatever the number)', () => {
    for (const d of [1, 3, 5, 9, 14, 2.5]) expect(weakenedDamage(enemy(), d, 0)).toBe(d);
  });

  it('applies to contact (the 1.5x elite / charge +3 included) and rounds to a whole point, never below 1', () => {
    const e = enemy(0.25, 3);
    expect(weakenedDamage(e, 14, 0)).toBe(11); // Manager contact: 10.5 rounds to 11
    expect(weakenedDamage(e, 4, 0)).toBe(3); // milk
    expect(weakenedDamage(e, 5 + 3, 0)).toBe(6); // a charging enemy's contact + 3
    expect(weakenedDamage(enemy(0.5, 3), 1, 0)).toBe(1); // never zero
    expect(weakenedDamage(enemy(0.5, 3), 3, 0)).toBe(2);
  });

  it('a projectile keeps what it had when it was FIRED: fired weakened it stays weakened after the status ran out, fired before it never is', () => {
    const e = enemy(0.25, 3); // weakened from 0 to 3
    const firedBefore = weakenedDamage({ status: newStatus() }, 9, 0); // an attack of the same enemy before it was weakened (a clean status)
    const firedDuring = weakenedDamage(e, 9, 1); // fired at t = 1, weakened
    expect(firedBefore).toBe(9);
    expect(firedDuring).toBe(7); // 6.75
    // The shot's damage is a plain number from then on: later weakening or its expiry does not touch it.
    const shots = [{ damage: firedBefore }, { damage: firedDuring }];
    applyWeaken(e.status, 0.5, 5, 2); // weakened further while the shots fly
    expect(shots.map((s) => s.damage)).toEqual([9, 7]);
    expect(weakenedDamage(e, 9, 10)).toBe(9); // an attack AFTER the status ran out is full again
  });
});

describe('weaken through the FakeCtx', () => {
  it('ctx.weaken logs the call and applies the status; bosses are not immune; affinity never scales the seconds', () => {
    const fake = new FakeCtx();
    const boss = fake.spawnReal('boss_frozen', { hp: 1000 }), turkey = fake.spawnReal('turkey', { hp: 1000 }); // the Freezer resists frost, the turkey is weak to heat
    fake.weaken(boss, 0.2, 2.5);
    fake.weaken(turkey, 0.2, 2.5);
    expect(fake.callsOf('weaken')).toEqual([
      { at: 0, kind: 'weaken', enemy: boss.id, pct: 0.2, seconds: 2.5 },
      { at: 0, kind: 'weaken', enemy: turkey.id, pct: 0.2, seconds: 2.5 },
    ]);
    expect(boss.status.weakenUntil).toBe(2.5);
    expect(turkey.status.weakenUntil).toBe(2.5);
    expect(weakenMult(boss.status, 1)).toBeCloseTo(0.8, 12);
  });

  it('it does not change what the enemy takes: weaken is about the damage it deals', () => {
    const fake = new FakeCtx();
    const a = fake.spawnReal('milk', { hp: 1000 }), b = fake.spawnReal('milk', { hp: 1000 });
    fake.weaken(a, 0.5, 3);
    fake.hit(a, 9, null); fake.hit(b, 9, null);
    expect(a.hp).toBe(b.hp);
  });
});

// ArenaScene cannot run headless: pin the wiring by source, like the affinity guards. Every damage an ENEMY does to the goblin goes through `enemyDmg`
// at the attacking enemy; hazards and events do not.
const SRC = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const src = (path: string): string => { const k = Object.keys(SRC).find((p) => p.endsWith(`/${path}`)); if (!k) throw new Error(`no source ${path}`); return SRC[k]; };

describe('wiring (source guards)', () => {
  const arena_ = src('scenes/ArenaScene.ts'), enemies = src('scenes/enemies.ts');

  it('every enemy damage source applies the attacker\'s weaken: contact, swipe, egg blast, shots (fired weakened), slush and lanes', () => {
    expect(arena_).toContain('enemyDmg(e: Enemy, dmg: number): number { return weakenedDamage(e, dmg, this.time.now / 1000); }');
    expect(arena_).toContain("this.hurtPlayer(this.enemyDmg(e, e.def.contactDamage + (charging ? 3 : 0)), attackBy(e, charging ? 'charge' : 'contact'))");
    expect(arena_).toContain("this.hurtPlayer(this.enemyDmg(e, e.def.attackDamage), attackBy(e, 'swipe'))"); // the swiper
    expect(enemies).toContain("scene.spawnEnemyShot('proj_bubble', e.x + Math.cos(ai) * 24, e.y - 34, ai, d.projectileSpeed, d.projectileLife, scene.enemyDmg(e, d.attackDamage), attackBy(e, 'shot'))");
    expect(enemies).toContain("scene.hurtPlayer(scene.enemyDmg(e, d.attackDamage), attackBy(e, 'blast'))"); // the egg
    expect(enemies).toContain("scene.hurtPlayer(scene.enemyDmg(e, d.attackDamage), attackBy(e, 'boss'))"); // slush and lanes
    expect(enemies).toContain("v.y, a, d.projectileSpeed, d.projectileLife, scene.enemyDmg(e, d.attackDamage), attackBy(e, 'shot'))"); // the boss volley
    expect(enemies).toContain("S.ring.speed, S.ring.life, scene.enemyDmg(e, d.attackDamage), attackBy(e, 'shot'))"); // the ring
  });

  it('no hurtPlayer or spawnEnemyShot call in the enemy AI takes a raw attack damage', () => {
    const calls = enemies.match(/(?:hurtPlayer|spawnEnemyShot)\([^\n]*/g) ?? [];
    expect(calls.length).toBe(6);
    for (const call of calls) if (/attackDamage|contactDamage/.test(call)) expect(call, call).toContain('enemyDmg(e, d.attackDamage)');
    expect(enemies).not.toMatch(/hurtPlayer\(d\.(attack|contact)Damage/);
    expect(arena_).not.toMatch(/hurtPlayer\(e\.def\.(attack|contact)Damage/);
  });

  it('hazards, events and the hooks\' own hurt are not enemy damage: they never use enemyDmg', () => {
    expect(src('scenes/hazards.ts')).not.toContain('enemyDmg');
    expect(src('scenes/events.ts')).not.toContain('enemyDmg');
    expect(src('scenes/phaserCtx.ts')).not.toContain('enemyDmg');
  });

  it('the status is on both ctx implementations and the marker is drawn beside the health bar', () => {
    expect(src('scenes/phaserCtx.ts')).toContain('applyWeaken(e.status, pct, seconds, this.now())');
    expect(src('engine/fakeCtx.ts')).toContain('applyWeaken(e.status, pct, seconds, this.time)');
    expect(arena_).toContain('weakenMult(e.status, t) >= 1');
  });
});

describe('armor pass: Frozen Turkey 2, Self-Checkout Kiosk 3, Walk-In Freezer 2', () => {
  it('the base defs carry the armor (Canned Beans keep 3), everything else stays unarmored', () => {
    expect(ENEMIES.turkey.armor).toBe(2);
    expect(ENEMIES.boss_checkout.armor).toBe(3);
    expect(ENEMIES.boss_frozen.armor).toBe(2);
    expect(ENEMIES.beans.armor).toBe(3);
    const armored = Object.values(ENEMIES).filter((d) => d.armor).map((d) => d.id).sort();
    expect(armored).toEqual(['beans', 'boss_checkout', 'boss_frozen', 'turkey']);
  });

  it('they share the one armor rule (the floor is Canned Beans\' minShare 0.3 for every armored enemy)', () => {
    const on = (id: keyof typeof ENEMIES) => ({ def: ENEMIES[id], status: newStatus() });
    expect(ENEMIES.beans.tune.minShare).toBe(0.3);
    for (const [id, armor] of [['turkey', 2], ['boss_checkout', 3], ['boss_frozen', 2]] as const) {
      expect(armorDamage(10, armor), id).toBe(10 - armor);
      expect(armorDamage(4, armor), id).toBe(Math.max(2, 4 - armor)); // ceil(4 x 0.3) = 2 floor
      expect(armorDamage(1, armor), id).toBe(1); // a 1 never goes below 1
      expect(hitArmor(on(id), 10, {}, 0), id).toBe(10 - armor);
      expect(hitArmor(on(id), 10, { isDot: true }, 0), id).toBe(10); // burn, poison and quiet ticks ignore it
      expect(hitArmor(on(id), 10, { quiet: true }, 0), id).toBe(10);
    }
  });

  it('Shred strips it: the Turkey (2) is open after 2 stacks, the Kiosk (3) needs 3, a 3rd stack on the Freezer adds damage', () => {
    expect([0, 1, 2, 3].map((k) => shreddedArmorDamage(10, ENEMIES.turkey.armor!, k))).toEqual([8, 9, 10, 11]);
    expect([0, 1, 2, 3].map((k) => shreddedArmorDamage(10, ENEMIES.boss_checkout.armor!, k))).toEqual([7, 8, 9, 10]);
    expect([0, 1, 2, 3].map((k) => shreddedArmorDamage(10, ENEMIES.boss_frozen.armor!, k))).toEqual([8, 9, 10, 11]);
  });

  it('mini-boss copies inherit it through the def spread (a Frozen Turkey giant keeps armor 2)', () => {
    const giant = miniBossDef(ENEMIES.turkey, MINI_BOSS.variants[0]);
    expect(giant.behavior).toBe('boss');
    expect(giant.armor).toBe(2);
    expect(miniBossDef(ENEMIES.beans, MINI_BOSS.variants[1]).armor).toBe(3);
    expect(miniBossDef(ENEMIES.milk, MINI_BOSS.variants[0]).armor).toBeUndefined();
  });

  it('the codex shows the armor chip for them automatically (and none for an unarmored boss)', () => {
    setLang('en');
    for (const [id, n] of [['turkey', 2], ['boss_checkout', 3], ['boss_frozen', 2]] as const) {
      const html = affinityRowsHtml(id);
      expect(html, id).toContain('aff-row armor');
      expect(html, id).toContain(`</svg>${n}</span>`);
    }
    expect(affinityRowsHtml('boss_bakery')).not.toContain('aff-row armor');
    expect(affinityRowsHtml('milk')).not.toContain('aff-row armor');
  });

  it('through the FakeCtx pipeline: a 10 hit does 8 on the turkey, 7 on the Kiosk, 8 on the Freezer', () => {
    const fake = new FakeCtx();
    const dealt = (id: 'turkey' | 'boss_checkout' | 'boss_frozen') => { const e = fake.spawnReal(id, { hp: 1000 }); fake.hit(e, 10, null, { label: 'x' }); return 1000 - e.hp; };
    expect([dealt('turkey'), dealt('boss_checkout'), dealt('boss_frozen')]).toEqual([8, 7, 8]);
  });
});
