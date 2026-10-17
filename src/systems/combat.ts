import type { BurnEffect, SlowEffect } from '../types';
import { ENEMIES } from '../data/enemies';
import { SHRED } from '../engine/define';
import { Enemy } from '../engine/ids';

export interface HitTracker { maxHits: number; hits: Set<number> }
export const newHitTracker = (maxHits: number): HitTracker => ({ maxHits, hits: new Set() });
export const isSpent = (t: HitTracker): boolean => t.hits.size >= t.maxHits;
export function tryHit(t: HitTracker, enemyId: number): boolean {
  if (t.hits.has(enemyId) || isSpent(t)) return false;
  t.hits.add(enemyId);
  return true;
}

export interface StatusFx { burnDps: number; burnUntil: number; burnTick: number; nextBurnAt: number; slowPct: number; slowUntil: number; poisonDps: number; poisonUntil: number; nextPoisonAt: number; shredStacks: number; shredUntil: number }
export const newStatus = (): StatusFx => ({ burnDps: 0, burnUntil: 0, burnTick: 0.5, nextBurnAt: 0, slowPct: 0, slowUntil: 0, poisonDps: 0, poisonUntil: 0, nextPoisonAt: 0, shredStacks: 0, shredUntil: 0 });

const EPS = 1e-9;

export function applyBurn(s: StatusFx, burn: BurnEffect, now: number): void {
  const active = s.burnUntil > now;
  s.burnDps = active ? Math.max(s.burnDps, burn.dps) : burn.dps;
  if (!active) { s.burnTick = burn.tick; s.nextBurnAt = now + burn.tick; }
  s.burnUntil = Math.max(s.burnUntil, now + burn.duration); // a short re-application never shortens a running burn
}

export function tickBurn(s: StatusFx, now: number): number {
  if (s.burnDps <= 0) return 0;
  let dmg = 0;
  const end = Math.min(now, s.burnUntil) + EPS;
  while (s.nextBurnAt <= end) { dmg += s.burnDps * s.burnTick; s.nextBurnAt += s.burnTick; }
  return dmg;
}

/** Poison: extends its end time (never shortens it), never stacks dps (keeps the higher one). Ticks every POISON_TICK, independent of burn. */
export const POISON_TICK = 0.5;
export function applyPoison(s: StatusFx, dps: number, duration: number, now: number): void {
  const active = s.poisonUntil > now;
  s.poisonDps = active ? Math.max(s.poisonDps, dps) : dps;
  if (!active) s.nextPoisonAt = now + POISON_TICK;
  s.poisonUntil = Math.max(s.poisonUntil, now + duration);
}

export function tickPoison(s: StatusFx, now: number): number {
  if (s.poisonDps <= 0) return 0;
  let dmg = 0;
  const end = Math.min(now, s.poisonUntil) + EPS;
  while (s.nextPoisonAt <= end) { dmg += s.poisonDps * POISON_TICK; s.nextPoisonAt += POISON_TICK; }
  return dmg;
}

export function applySlow(s: StatusFx, slow: SlowEffect, now: number): void {
  const active = s.slowUntil > now;
  s.slowPct = active ? Math.max(s.slowPct, slow.pct) : slow.pct;
  s.slowUntil = Math.max(active ? s.slowUntil : 0, now + slow.duration);
}

/**
 * Shred: -1 armor per stack (docs/item-hooks-refactor.md "Shred"). Stacks add up to `SHRED.cap` and share one timer: a new application refreshes the end
 * to the later of the two, and when the timer has run out the old stacks are gone before the new ones are added (they expire together, not one by one).
 */
export function applyShred(s: StatusFx, stacks: number, duration: number, now: number): void {
  if (s.shredUntil <= now) s.shredStacks = 0;
  s.shredStacks = Math.min(SHRED.cap, s.shredStacks + stacks);
  s.shredUntil = Math.max(s.shredUntil, now + duration);
}

/** The stacks that count right now (0 once the timer ran out). */
export const shredStacks = (s: StatusFx, now: number): number => (s.shredUntil > now ? s.shredStacks : 0);

export const slowFactor = (s: StatusFx, now: number): number => (s.slowUntil > now ? 1 - s.slowPct : 1);

export function pickRicochetTarget<T extends { id: number; x: number; y: number }>(from: { x: number; y: number }, candidates: T[], hit: Set<number>, range: number): T | null {
  let best: T | null = null, bd = range * range;
  for (const c of candidates) {
    if (hit.has(c.id)) continue;
    const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
    if (d <= bd) { best = c; bd = d; }
  }
  return best;
}

export const rollCrit = (chance: number, rng: () => number): boolean => chance > 0 && rng() < chance;

/** The multipliers every kill coin payout shares: department, door modifier, shift, aisle event (Flash Sale ...) and the cart's kill-coin items. */
export interface KillCoinMults { dept: number; modifier: number; shift: number; event: number; kill: number }
/** Their product, in this exact order (the regular kill coins roll against it). */
export const killCoinMult = (m: KillCoinMults): number => m.dept * m.modifier * m.shift * m.event * m.kill;

/** Gift Card jackpot: `base` x `jackpot` x the same multipliers as the regular kill coins, rounded. Always dropped in full (no per-coin roll, no rng draw). */
export const giftcardCoins = (base: number, jackpot: number, m: KillCoinMults): number => Math.round(base * jackpot * m.dept * m.modifier * m.shift * m.event * m.kill);

/** Expected value = base * mult: floor plus a bonus coin with probability of the fractional part. */
export function killCoins(base: number, coinMult: number, rng: () => number): number {
  const v = base * coinMult, f = Math.floor(v);
  return f + (rng() < v - f ? 1 : 0);
}

/** Armor soaks flat damage off a direct hit but never more than 70% of it (min 30%, rounded up). */
export const armorDamage = (dmg: number, armor: number): number => (armor > 0 ? Math.max(Math.ceil(dmg * ENEMIES.beans.tune.minShare), dmg - armor) : dmg);

/**
 * Armor with shred: effective armor = `armor - stacks`. Above 0 it is the plain armor rule; at 0 the hit is untouched; below 0 the enemy is exposed and
 * the hit gains 1 per missing armor point, but at most `SHRED.bonusShare` of itself (rounded up). With no stacks it is exactly `armorDamage`.
 */
export function shreddedArmorDamage(dmg: number, armor: number, stacks: number): number {
  const eff = armor - stacks;
  if (eff > 0) return armorDamage(dmg, eff);
  return eff < 0 ? dmg + Math.min(-eff, Math.ceil(dmg * SHRED.bonusShare)) : dmg;
}

/**
 * The armor step of the damage pipeline, shared by `ArenaScene.damageEnemy` and `FakeCtx`: direct hits only (burn / poison ticks and quiet area ticks pass
 * through untouched; the vacuum pulse is not quiet and is armored). Reads the enemy's armor and its live shred stacks.
 */
export function hitArmor(e: { def: { armor?: number }; status: StatusFx }, dmg: number, o: { isDot?: boolean; quiet?: boolean }, now: number): number {
  if (o.isDot || o.quiet) return dmg;
  return shreddedArmorDamage(dmg, e.def.armor ?? 0, shredStacks(e.status, now));
}

/** Cereal shield: blocks a shot when its reversed travel direction is within the half-angle of the facing vector. */
export function shieldBlocks(shotVx: number, shotVy: number, faceX: number, faceY: number, halfDeg = ENEMIES.cereal.tune.halfAngleDeg): boolean {
  const sl = Math.hypot(shotVx, shotVy), fl = Math.hypot(faceX, faceY);
  if (!sl || !fl) return false;
  return (-shotVx * faceX - shotVy * faceY) / (sl * fl) > Math.cos((halfDeg * Math.PI) / 180);
}

interface Healable { x: number; y: number; hp: number; maxHp: number; alive: boolean; def: { id: string; behavior?: string } }
/** Honey heal tick: HP each ally in range gains (capped at max). Skips the healer, boss and other honey jars. */
export function healTargets<T extends Healable>(healer: T, all: T[], radius = ENEMIES.honey.tune.radius, pct = ENEMIES.honey.tune.pct): { target: T; amount: number }[] {
  const out: { target: T; amount: number }[] = [];
  for (const o of all) {
    if (o === healer || !o.alive || o.def.id === Enemy.boss || o.def.behavior === 'boss' || o.def.id === Enemy.honey || o.hp >= o.maxHp) continue;
    if (Math.hypot(o.x - healer.x, o.y - healer.y) > radius) continue;
    out.push({ target: o, amount: Math.min(o.maxHp - o.hp, o.maxHp * pct) });
  }
  return out;
}
