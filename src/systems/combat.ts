import type { BurnEffect, SlowEffect } from '../types';
import { ARMOR, HONEY, SHIELD } from '../data/enemies';

export interface HitTracker { maxHits: number; hits: Set<number> }
export const newHitTracker = (maxHits: number): HitTracker => ({ maxHits, hits: new Set() });
export const isSpent = (t: HitTracker): boolean => t.hits.size >= t.maxHits;
export function tryHit(t: HitTracker, enemyId: number): boolean {
  if (t.hits.has(enemyId) || isSpent(t)) return false;
  t.hits.add(enemyId);
  return true;
}

export interface StatusFx { burnDps: number; burnUntil: number; burnTick: number; nextBurnAt: number; slowPct: number; slowUntil: number }
export const newStatus = (): StatusFx => ({ burnDps: 0, burnUntil: 0, burnTick: 0.5, nextBurnAt: 0, slowPct: 0, slowUntil: 0 });

const EPS = 1e-9;

export function applyBurn(s: StatusFx, burn: BurnEffect, now: number): void {
  const active = s.burnUntil > now;
  s.burnDps = active ? Math.max(s.burnDps, burn.dps) : burn.dps;
  if (!active) { s.burnTick = burn.tick; s.nextBurnAt = now + burn.tick; }
  s.burnUntil = now + burn.duration;
}

export function tickBurn(s: StatusFx, now: number): number {
  if (s.burnDps <= 0) return 0;
  let dmg = 0;
  const end = Math.min(now, s.burnUntil) + EPS;
  while (s.nextBurnAt <= end) { dmg += s.burnDps * s.burnTick; s.nextBurnAt += s.burnTick; }
  return dmg;
}

export function applySlow(s: StatusFx, slow: SlowEffect, now: number): void {
  const active = s.slowUntil > now;
  s.slowPct = active ? Math.max(s.slowPct, slow.pct) : slow.pct;
  s.slowUntil = Math.max(active ? s.slowUntil : 0, now + slow.duration);
}

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

/** Expected value = base * mult: floor plus a bonus coin with probability of the fractional part. */
export function killCoins(base: number, coinMult: number, rng: () => number): number {
  const v = base * coinMult, f = Math.floor(v);
  return f + (rng() < v - f ? 1 : 0);
}

/** Armor soaks flat damage off a direct hit but never more than 70% of it (min 30%, rounded up). */
export const armorDamage = (dmg: number, armor: number): number => (armor > 0 ? Math.max(Math.ceil(dmg * ARMOR.minShare), dmg - armor) : dmg);

/** Cereal shield: blocks a shot when its reversed travel direction is within the half-angle of the facing vector. */
export function shieldBlocks(shotVx: number, shotVy: number, faceX: number, faceY: number, halfDeg = SHIELD.halfAngleDeg): boolean {
  const sl = Math.hypot(shotVx, shotVy), fl = Math.hypot(faceX, faceY);
  if (!sl || !fl) return false;
  return (-shotVx * faceX - shotVy * faceY) / (sl * fl) > Math.cos((halfDeg * Math.PI) / 180);
}

interface Healable { x: number; y: number; hp: number; maxHp: number; alive: boolean; def: { id: string; behavior?: string } }
/** Honey heal tick: HP each ally in range gains (capped at max). Skips the healer, boss and other honey jars. */
export function healTargets<T extends Healable>(healer: T, all: T[], radius = HONEY.radius, pct = HONEY.pct): { target: T; amount: number }[] {
  const out: { target: T; amount: number }[] = [];
  for (const o of all) {
    if (o === healer || !o.alive || o.def.id === 'boss' || o.def.behavior === 'boss' || o.def.id === 'honey' || o.hp >= o.maxHp) continue;
    if (Math.hypot(o.x - healer.x, o.y - healer.y) > radius) continue;
    out.push({ target: o, amount: Math.min(o.maxHp - o.hp, o.maxHp * pct) });
  }
  return out;
}
