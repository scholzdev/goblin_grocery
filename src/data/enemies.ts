import type { DepartmentId, EnemyDef, EnemyId } from '../types';

const base = {
  tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0,
  lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0,
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  milk: { ...base, id: 'milk', name: 'Sour Milk', blurb: "Past its date and furious about it. Just walks at you. Repeatedly.", behavior: 'chase', hp: 14, speed: 72, contactDamage: 4, coins: 1, radius: 17 },
  banana: {
    ...base, id: 'banana', name: 'Banana Bandit', blurb: "Winds up, then slides in for a peel-out lunge. Sidestep it.", behavior: 'charger', hp: 12, speed: 80, contactDamage: 5, coins: 1, radius: 16,
    tell: 0.6, attackCooldown: 2.6, attackRange: 260, lungeSpeed: 430, lungeTime: 0.38,
  },
  soda: {
    ...base, id: 'soda', name: 'Soda Six-Pack', blurb: "Six cans, one grudge. Slow and fizzy-tough; barely flinches at shoves.", behavior: 'tank', hp: 48, speed: 46, contactDamage: 6, coins: 2, radius: 25,
    knockbackResist: 0.8,
  },
  spitter: {
    ...base, id: 'spitter', name: 'Detergent Spitter', blurb: "Squirts slow blobs of detergent from afar. Close in or weave.", behavior: 'spitter', hp: 18, speed: 64, contactDamage: 4, coins: 2, radius: 18,
    tell: 0.45, attackCooldown: 2.6, attackRange: 420, attackDamage: 5, projectileSpeed: 125, projectileLife: 4, preferredDistance: 270,
  },
  baguette: {
    ...base, id: 'baguette', name: 'Baguette Bruiser', blurb: "Swings a wide crusty arc when you get close. Back off or break it.", behavior: 'swiper', hp: 34, speed: 68, contactDamage: 5, coins: 2, radius: 19,
    tell: 0.55, attackCooldown: 2.2, attackRange: 92, attackDamage: 7, arcDeg: 110, knockbackResist: 0.3,
  },
  egg: {
    ...base, id: 'egg', name: 'Egg Carton', blurb: "Waddles close and explodes. Pop it first.", behavior: 'exploder', hp: 30, speed: 60, contactDamage: 3, coins: 2, radius: 20,
    tell: 0.7, attackRange: 70, attackDamage: 8,
  },
  melon: {
    ...base, id: 'melon', name: 'Watermelon', blurb: "Bursts into three fast slices when it dies. Mind the mess.", behavior: 'splitter', hp: 60, speed: 50, contactDamage: 6, coins: 3, radius: 30,
    knockbackResist: 0.5,
  },
  turkey: {
    ...base, id: 'turkey', name: 'Frozen Turkey', blurb: "Frozen solid, heavy as a brick. Takes forever to thaw out.", behavior: 'tank', hp: 150, speed: 38, contactDamage: 9, coins: 4, radius: 34,
    knockbackResist: 0.92,
  },
  beans: {
    ...base, id: 'beans', name: 'Canned Beans', blurb: "Dented, dense and armored: direct hits lose 3 damage. Burn, puddles and auras ignore the tin.", behavior: 'chase', hp: 40, speed: 52, contactDamage: 5, coins: 2, radius: 20,
    armor: 3, knockbackResist: 0.4,
  },
  cereal: {
    ...base, id: 'cereal', name: 'Cereal Box', blurb: "Holds a cardboard front up: the first 6 shots bounce off, then it goes soggy. Sweeps, blasts, burn and shoves ignore it.", behavior: 'chase', hp: 45, speed: 58, contactDamage: 5, coins: 3, radius: 23,
    shield: true, knockbackResist: 0.3,
  },
  honey: {
    ...base, id: 'honey', name: 'Honey Jar', blurb: "Hangs back and heals nearby groceries 3% every second. Sticky business; pop it first.", behavior: 'healer', hp: 35, speed: 56, contactDamage: 3, coins: 3, radius: 18,
    preferredDistance: 220,
  },
  giftcard: {
    ...base, id: 'giftcard', name: 'Gift Card', blurb: "Runs from you and escapes after 8 seconds. Catch it for a jackpot of coins.", behavior: 'thief', hp: 30, speed: 120, contactDamage: 1, coins: 2, radius: 16,
  },
  expired: {
    ...base, id: 'expired', name: 'Expired Milk', blurb: "Flickers, then blinks right next to you. Watch for the dashed ring.", behavior: 'teleporter', hp: 28, speed: 66, contactDamage: 6, coins: 2, radius: 17,
    tell: 0.6,
  },
  gum: {
    ...base, id: 'gum', name: 'Bubble Gum', blurb: "Chews after you, leaving sticky pink puddles that slow your walk. Bursts into a trap when popped.", behavior: 'chase', hp: 26, speed: 70, contactDamage: 4, coins: 2, radius: 17,
    trail: true,
  },
  slice: { ...base, id: 'slice', name: 'Melon Slice', blurb: "A juicy little leftover. Fast, fragile, worth no coins.", behavior: 'chase', hp: 5, speed: 95, contactDamage: 3, coins: 0, radius: 14 },
  boss: {
    ...base, id: 'boss', name: 'The Store Manager', blurb: "Volleys, charges and summons. Gets cranky if you take too long.", behavior: 'boss', hp: 1500, speed: 55, contactDamage: 14, coins: 30, radius: 48,
    knockbackResist: 1, tell: 0.8, attackCooldown: 2.4, attackDamage: 9, projectileSpeed: 200, projectileLife: 5,
    lungeSpeed: 520, lungeTime: 0.7,
  },
};

/** Codex order: by first aisle, slice after melon, boss last. */
export const CODEX_ENEMIES: EnemyId[] = ['milk', 'banana', 'giftcard', 'soda', 'beans', 'gum', 'spitter', 'turkey', 'cereal', 'expired', 'baguette', 'egg', 'honey', 'melon', 'slice', 'boss'];

/** Detergent Spitter volley: a fan of bubbles per attack. */
export const SPITTER = { shots: 3, spreadDeg: 22 };

/** Half of the Manager's summons come from the run's theme. */
export const THEME_SUMMONS: Partial<Record<DepartmentId, EnemyId[]>> = {
  main: ['cereal', 'beans'], frozen: ['expired', 'milk'], bakery: ['baguette', 'banana'], electronics: ['spitter', 'beans'], checkout: ['gum', 'banana'],
};

export const BOSS = {
  /** Coins dropped by the Manager (shift coin cuts don't apply: harder shifts pay more). */
  coins: 30,
  enrageAfter: 60,
  enrageCooldownMult: 0.6,
  halfHpCooldownMult: 0.75,
  volleyCount: 7,
  volleySpreadDeg: 70,
  summonCount: 4,
  summonTypes: ['milk', 'banana'] as EnemyId[],
};

/**
 * Mid-shift boss: a giant grocery from the run's theme with slimmed-down Manager moves.
 * Arrives `at` seconds into its aisle; the aisle ends when it dies and it drops 3 crates (pick 1).
 */
export const MINI_BOSS = {
  aisle: 4,
  at: 8,
  hp: 450,
  scale: 2.1,
  coins: 12,
  /** Seconds after it arrives before it enrages (faster moves, like the Manager). */
  enrageAfter: 45,
  /** Def overrides for the giant (the base grocery keeps its sprite and radius). */
  def: { knockbackResist: 1, tell: 0.85, attackCooldown: 2.8, attackDamage: 7, contactDamage: 10, projectileSpeed: 190, projectileLife: 4.5, lungeSpeed: 460, lungeTime: 0.6, speed: 50 },
  moves: { volleyCount: 5, volleySpreadDeg: 60, summonCount: 2 },
  byTheme: { main: 'soda', frozen: 'turkey', bakery: 'baguette', electronics: 'spitter', checkout: 'banana' } as Partial<Record<DepartmentId, EnemyId>>,
  /** Crates: one legendary (when any is unlocked), the rest weapons at this tier. */
  crates: 3,
  weaponTier: 2,
};

/**
 * Elite groceries: tougher, bigger, gold-ringed, pay more. Rolled per spawn; never boss/slice/egg.
 * chanceByAisle[i] is the chance in aisle i+1 (regular aisles only); overtime uses overtimeChance;
 * each shift adds shiftBonus.
 */
export const ELITE = { hpMult: 3.5, scale: 1.35, contactMult: 1.5, coinMult: 3, chanceByAisle: [0, 0, 0.08, 0.12, 0.16, 0.2, 0.25], overtimeChance: 0.3, shiftBonus: 0.03 };
export const ELITE_EXCLUDED: EnemyId[] = ['boss', 'slice', 'egg', 'giftcard'];

/** Every Elite rolls one affix. Splitter skips types that already split or are tiny. */
export type EliteAffix = 'swift' | 'tough' | 'splitter' | 'pickpocket';
export const ELITE_AFFIXES: EliteAffix[] = ['swift', 'tough', 'splitter', 'pickpocket'];
export const SPLITTER_EXCLUDED: EnemyId[] = ['melon', 'slice', 'honey'];
export const AFFIX = {
  swift: { speedMult: 1.4, color: 0x7cc4e8 },
  tough: { regenPct: 0.02, idle: 2, color: 0x8fcb57 },                     // % max HP per second after `idle` s without being hit
  splitter: { count: 2, scale: 0.4, hpMult: 0.4, color: 0xb08ae0 },         // copies at 40% scale / HP of the base type
  pickpocket: { radius: 170, pull: 120, absorbRadius: 26, color: 0xf45f52 }, // px; pull speed px/s
};

/** Egg Carton blast: ground-ring radius, and damage dealt to other groceries caught in it. */
export const EGG_BLAST = { radius: 90, enemyDamage: 12 };
/** Canned Beans: damage after armor is never below this share of the hit. */
export const ARMOR = { minShare: 0.3 };
/** Cereal Box: shots whose reversed path is within this angle of its facing (toward the player) are blocked,
 *  until the cardboard has soaked up `blocks` shots (x eliteMult on Elites); then it goes soggy and everything hits. */
export const SHIELD = { halfAngleDeg: 60, blocks: 6, eliteMult: 2 };
/** Honey Jar: heals allies in range every `interval` s for `pct` of their max HP. */
export const HONEY = { interval: 1, radius: 160, pct: 0.03, keepAway: 220 };
/** Gift Card: escapes after `escapeAfter` s; kills pay `coinMult`x coins (always dropped). */
export const GIFTCARD = { escapeAfter: 8, coinMult: 8 };
/** Expired Milk: blink cadence, landing ring distance and clearance from props. */
export const EXPIRED = { interval: 4, tell: 0.6, ringDist: 110, clearance: 60 };
/** Bubble Gum: puddle cadence/cap/life, player slow, trap radius multiplier on death. */
export const GUM = { interval: 1.5, maxPerGum: 6, life: 6, radius: 34, slow: 0.3, trapRadiusMult: 1.6 };

/** Watermelon death: slices spawned. */
export const MELON_SLICES = 3;

/** Health bars appear on these enemies once damaged (never at full HP, to avoid clutter). */
export const SHOW_HP_BAR: EnemyId[] = ['milk', 'banana', 'soda', 'baguette', 'spitter', 'egg', 'melon', 'slice', 'turkey', 'beans', 'cereal', 'honey', 'expired', 'gum'];
