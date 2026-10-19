import type { DepartmentId, EnemyId, WaveDef } from '../types';
import { BOSS, type BossTuning, ELITE, ELITE_EXCLUDED, bossFor, isBossId } from './enemies';
import { DEPARTMENTS, THEMES } from './departments';
import { Enemy } from '../engine/ids';

export const WAVES: WaveDef[] = [
  { index: 1, duration: 60, boss: false, total: 30, mix: { milk: 1 }, group: [2, 3], hpScale: 1.15, speedScale: 1, dmgScale: 1.5 },
  { index: 2, duration: 60, boss: false, total: 33, mix: { milk: 3, banana: 2, giftcard: 0.3 }, group: [2, 4], hpScale: 1.15, speedScale: 1, dmgScale: 1.6 },
  { index: 3, duration: 60, boss: false, total: 44, mix: { milk: 3, banana: 2, soda: 1, beans: 0.5, gum: 0.6, giftcard: 0.3, sanitizer: 0.35 }, group: [3, 4], hpScale: 1.24, speedScale: 1, dmgScale: 1.8 },
  { index: 4, duration: 60, boss: false, total: 55, mix: { milk: 3, banana: 2, soda: 1, spitter: 1.5, turkey: 0.6, beans: 0.6, gum: 0.8, cereal: 0.5, expired: 0.6, giftcard: 0.3, sanitizer: 0.4 }, group: [3, 5], hpScale: 1.5, speedScale: 1.04, dmgScale: 1.6 },
  { index: 5, duration: 60, boss: false, total: 65, mix: { milk: 2, banana: 2, soda: 1, spitter: 1, baguette: 1.5, egg: 1, turkey: 0.8, beans: 0.8, gum: 0.8, cereal: 0.8, expired: 0.8, honey: 0.4, giftcard: 0.3, sanitizer: 0.5 }, group: [3, 5], hpScale: 1.8, speedScale: 1.06, dmgScale: 1.7 },
  { index: 6, duration: 60, boss: false, total: 75, mix: { milk: 2, banana: 2, soda: 1.5, spitter: 1.5, baguette: 1.5, egg: 1, melon: 1, turkey: 1, beans: 1, gum: 1, cereal: 1, expired: 1, honey: 0.5, giftcard: 0.3, sanitizer: 0.5 }, group: [4, 6], hpScale: 2.2, speedScale: 1.08, dmgScale: 1.8 },
  { index: 7, duration: 60, boss: false, total: 86, mix: { milk: 2, banana: 2, soda: 2, spitter: 1.5, baguette: 2, egg: 1.5, melon: 1.5, turkey: 1.2, beans: 1.2, gum: 1.2, cereal: 1.2, expired: 1.2, honey: 0.6, giftcard: 0.3, sanitizer: 0.6 }, group: [4, 7], hpScale: 2.6, speedScale: 1.1, dmgScale: 1.9 },
  { index: 8, duration: 60, boss: true, total: 6, mix: { milk: 2, banana: 1 }, group: [2, 3], hpScale: 2.6, speedScale: 1.1, dmgScale: 2.0 },
];

export const BOSS_WAVE = WAVES.length;

/** Where an enemy shows up: aisle range from WAVES mixes (slice rides along with melon, boss = last aisle) and departments that favour it. */
export function enemyAppears(id: EnemyId): { first: number; last: number; depts: DepartmentId[] } {
  if (isBossId(id)) return { first: BOSS_WAVE, last: BOSS_WAVE, depts: id === 'boss' ? [] : THEMES.filter((d) => bossFor(d) === id) };
  const src = id === 'slice' ? 'melon' : id;
  const aisles = WAVES.filter((w) => !w.boss && (w.mix[src] ?? 0) > 0).map((w) => w.index);
  const depts = THEMES.filter((d) => (DEPARTMENTS[d].mix[src] ?? 0) > 1);
  return { first: aisles[0], last: aisles[aisles.length - 1], depts };
}

/** Overtime (after the boss): aisles keep scaling off the last regular wave. */
export const OVERTIME = { total: 0.08, hpGrowth: 1.25, dmgGrowth: 1.1, speed: 0.02, speedCap: 1.3 };

/** Elite chance for an enemy type in a wave and shift (0-based). Overtime aisles use ELITE.overtimeChance. */
export function eliteChance(id: EnemyId, wave: WaveDef, shift: number): number {
  if (wave.boss || ELITE_EXCLUDED.includes(id)) return 0;
  const base = wave.index <= ELITE.chanceByAisle.length ? ELITE.chanceByAisle[wave.index - 1] : ELITE.overtimeChance;
  return base > 0 ? Math.min(1, base + ELITE.shiftBonus * shift) : 0;
}

/** Wave definition for any aisle; past the boss it's synthesized (endless). */
export function waveDef(index: number): WaveDef {
  if (index <= BOSS_WAVE) return WAVES[Math.max(1, index) - 1];
  const b = WAVES[BOSS_WAVE - 2], n = index - BOSS_WAVE;
  return { ...b, index, boss: false, total: Math.round(b.total * (1 + OVERTIME.total * n)), hpScale: b.hpScale * OVERTIME.hpGrowth ** n, dmgScale: b.dmgScale * OVERTIME.dmgGrowth ** n, speedScale: Math.min(OVERTIME.speedCap, b.speedScale + OVERTIME.speed * n) };
}

export interface ShiftDef {
  name: string; blurb: string; hpMult: number; speedMult: number; countMult: number; coinMult: number; bossHpMult: number; dmgMult: number;
  /** Store Manager tuning overrides for this shift (merged over BOSS). */
  boss?: Partial<BossTuning>;
}

/** Difficulty ladder, index 0 = Shift 1 (base game). Multipliers stack with department ones. */
export const SHIFTS: ShiftDef[] = [
  { name: 'Day Shift', blurb: 'The store as you know it.', hpMult: 1, speedMult: 1, countMult: 1, coinMult: 1, bossHpMult: 1, dmgMult: 1 },
  { name: 'Evening Shift', blurb: 'Tougher groceries.', hpMult: 1.2, speedMult: 1, countMult: 1, coinMult: 1, bossHpMult: 1.1, dmgMult: 1.1, boss: { coins: 45, volleyCount: 9 } },
  { name: 'Late Shift', blurb: 'Tougher, faster, more of them.', hpMult: 1.35, speedMult: 1.08, countMult: 1.15, coinMult: 1, bossHpMult: 1.2, dmgMult: 1.2, boss: { coins: 60, volleyCount: 9, summonTypes: [Enemy.milk, Enemy.banana, Enemy.egg] } },
  { name: 'Graveyard Shift', blurb: 'Crowded aisles, thinner pockets.', hpMult: 1.5, speedMult: 1.12, countMult: 1.25, coinMult: 0.85, bossHpMult: 1.3, dmgMult: 1.3, boss: { coins: 80, volleyCount: 9, summonTypes: [Enemy.milk, Enemy.banana, Enemy.egg], summonCount: 6, enrageAfter: 45 } },
  { name: 'Black Friday', blurb: 'Everyone wants a refund. Everyone.', hpMult: 1.7, speedMult: 1.15, countMult: 1.35, coinMult: 0.8, bossHpMult: 1.4, dmgMult: 1.45, boss: { coins: 100, volleyCount: 11, summonTypes: [Enemy.banana, Enemy.egg, Enemy.melon], summonCount: 6, enrageAfter: 35 } },
];

/** Effective Store Manager tuning for a shift (BOSS + that shift's overrides). */
export const bossTuning = (shift: number): BossTuning => ({ ...BOSS, ...SHIFTS[shift]?.boss });

export const ECONOMY = {
  waveClearBonus: 12,
  /** Reroll n (0-based) costs (1 + ceil(shop / 2)) * (n + 1). */
  rerollBase: 1,
  repairBase: 6,      // repair = base + perShop * shop
  repairPerShop: 2,
  /** Item prices rise this much per shop after the first. */
  inflationPerShop: 0.1,
  repairHp: 10,
  offerCount: 4,
  /** Chance (from shop 2) that a rolled offer is a double pack, and its price multiplier. */
  doublePackChance: 0.08,
  doublePackPriceMult: 1.5,
  shelfSlots: 4,
  maxActiveEnemies: 70,
  /** Each coin a kill would drop actually drops with this chance (longer waves = more kills, so fewer coins each). */
  killCoinChance: 0.4,
  /** Store services (always on sale until maxed). Cart grows right/down, so placed items never move. */
  cartSizes: [[5, 4], [6, 4], [6, 5], [7, 5]] as [number, number][],
  cartPrices: [15, 25, 40, 60],
  shelfSizes: [5, 6],
  shelfPrices: [12, 20],
};

/** Within a wave, enemies spawned later are tougher and groups arrive more densely.
 *  The ramp itself grows with the aisle: tiny in aisle 1, full strength from aisle `fullAtWave`. */
export const WAVE_RAMP = { hp: 0.4, speed: 0.12, densityPow: 0.8, fullAtWave: 6 };

/**
 * Loyalty Card (shop upgrade). Index = level - 1. Upgrade cost is paid to reach the NEXT level.
 * Odds are per offer slot; legendaries only from shopIndex >= 2. Pre-tiered offers cost TIER.value.
 */
export const SHOP_LEVELS = [
  { upgradeCost: 20, tier2: 0, tier3: 0, legendary: 0.03, freeReroll: false },
  { upgradeCost: 35, tier2: 0.18, tier3: 0, legendary: 0.06, freeReroll: false },
  { upgradeCost: 55, tier2: 0.28, tier3: 0.04, legendary: 0.1, freeReroll: true },
  { upgradeCost: 0, tier2: 0.36, tier3: 0.1, legendary: 0.16, freeReroll: true },
];
