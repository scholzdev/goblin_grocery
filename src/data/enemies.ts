import type { DepartmentId, EnemyDef, EnemyId } from '../types';
import { ENEMY_ORDER, enemyTextTune, resolveTune, type AffinityTag, type BossKit, type BossMove, type BossSpecial, type EnemyContent } from '../engine/define';
import { Enemy } from '../engine/ids';
import { contentEnemy } from '../engine/registry';
import { renderText } from '../engine/text';

export type { BossKit, BossMove, BossSpecial };

// Plain tables derived from the enemy content files (src/content/enemies/<id>.ts): stats, tune, kits. What stays here has no single owner: the
// shared boss rules (BOSS), the mid-shift boss (MINI_BOSS: its variants name one enemy per theme), Elites and their affixes, the theme summon
// pools and the codex order. The AI itself is scenes/enemies.ts.

const base = {
  tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0,
  lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0,
};

const content = (id: EnemyId): EnemyContent => {
  const c = contentEnemy(id);
  if (!c) throw new Error(`enemy "${id}" has no content file (src/content/enemies/${id}.ts)`);
  return c;
};

/** What the game reads of an enemy: its stats (missing ones 0), sprite scale, tune and affinity, plus the English codex text (the language-aware one is `enemyT`). */
const defOf = (c: EnemyContent): EnemyDef => ({
  ...base, ...c.stats, id: c.id, behavior: c.behavior, scale: c.scale, tune: resolveTune(c.tune, 1),
  ...(c.weak ? { weak: c.weak } : {}), ...(c.resist ? { resist: c.resist } : {}),
  name: c.text.en.name, blurb: renderText(c.text.en.blurb, enemyTextTune(c), 1, 'en'),
});

/** Every enemy, in `ENEMY_ORDER` (engine/define). */
export const ENEMIES: Record<EnemyId, EnemyDef> = Object.fromEntries(ENEMY_ORDER.map((id) => [id, defOf(content(id))])) as Record<EnemyId, EnemyDef>;

/** Boss ids (a final boss per theme): behavior 'boss' + a kit; the sprite keys are `${id}_a|b|tell`. */
export const BOSS_IDS: EnemyId[] = ENEMY_ORDER.filter((id) => content(id).behavior === 'boss');
export const isBossId = (id: EnemyId): boolean => BOSS_IDS.includes(id);
export const BOSS_BY_THEME: Record<string, EnemyId> = Object.fromEntries(BOSS_IDS.map((id) => [content(id).boss!.theme, id]));
/** The final boss of a run theme (Manager if unknown). */
export const bossFor = (theme: DepartmentId): EnemyId => BOSS_BY_THEME[theme] ?? 'boss';
/** Sprite texture key of any enemy (bosses use `boss_*`, the rest `enemy_*`); f = a | b | tell. */
export const enemyFrame = (id: EnemyId, f: 'a' | 'b' | 'tell' = 'a'): string => (isBossId(id) ? `${id}_${f}` : `enemy_${id}_${f}`);

/** Each boss's move set (from its content file). */
export const BOSS_KITS: Record<string, BossKit> = Object.fromEntries(BOSS_IDS.map((id) => [id, content(id).boss!.kit]));
/** The Manager's move loop (mini-bosses of the stampeder variant reuse it). */
export const BOSS_CYCLE: BossMove[] = BOSS_KITS.boss.cycle;
/** Signature move tuning (damage = the boss's attackDamage): the `tune` of the boss that owns the move (slush: Walk-In Freezer, ring: Industrial Oven, lanes: Smart-TV Wall, belt: Self-Checkout Kiosk). */
export const BOSS_SPECIAL = Object.fromEntries(BOSS_IDS.flatMap((id) => { const k = content(id).boss!.kit; return k.special ? [[k.special, ENEMIES[id].tune]] : []; })) as Record<BossSpecial, Readonly<Record<string, number>>>;

/** Codex order: by first aisle, slice after melon, boss last. */
export const CODEX_ENEMIES: EnemyId[] = ['milk', 'banana', 'giftcard', 'soda', 'beans', 'gum', 'sanitizer', 'spitter', 'expired', 'turkey', 'cereal', 'baguette', 'egg', 'honey', 'melon', 'slice', ...BOSS_IDS];

/** The enemies (codex order: the groceries, then the bosses) weak to any of `tags`: what the shop card's "Strong vs" lists. Derived from the enemy files; the mini-bosses are their base grocery. */
export const enemiesWeakTo = (tags: readonly AffinityTag[]): EnemyId[] => CODEX_ENEMIES.filter((id) => tags.some((tag) => (ENEMIES[id].weak?.[tag] ?? 0) > 0));

/** Half of the Manager's (and mini-bosses') summons come from the run's theme. */
export const THEME_SUMMONS: Partial<Record<DepartmentId, EnemyId[]>> = {
  main: ['cereal', 'beans'], frozen: ['expired', 'milk'], bakery: ['baguette', 'banana'], electronics: ['spitter', 'beans'], checkout: ['gum', 'banana'],
};

/** The Store Manager's tuning; a shift overrides some of it (`ShiftDef.boss`). */
export interface BossTuning {
  coins: number; enrageAfter: number; enrageCooldownMult: number; halfHpCooldownMult: number;
  volleyCount: number; volleySpreadDeg: number; summonCount: number; summonTypes: EnemyId[];
}
export const BOSS: BossTuning = {
  /** Coins dropped by the Manager (shift coin cuts don't apply: harder shifts pay more). */
  coins: 30,
  enrageAfter: 60,
  enrageCooldownMult: 0.6,
  halfHpCooldownMult: 0.75,
  volleyCount: 7,
  volleySpreadDeg: 70,
  summonCount: 4,
  summonTypes: [Enemy.milk, Enemy.banana],
};

/**
 * Mid-shift boss: a giant grocery from the run's theme with slimmed-down Manager moves.
 * Arrives `at` seconds into its aisle; the aisle ends when it dies and it drops 3 crates (pick 1).
 */
export const MINI_BOSS = {
  aisle: 4,
  at: 8,
  hp: 340,
  scale: 2.1,
  coins: 12,
  /** Seconds after it arrives before it enrages (faster moves, like the Manager). */
  enrageAfter: 45,
  /** Def overrides for the giant (the base grocery keeps its sprite and radius); variants may override more. */
  def: { knockbackResist: 1, tell: 0.85, attackCooldown: 2.8, attackDamage: 7, contactDamage: 10, projectileSpeed: 190, projectileLife: 4.5, lungeSpeed: 460, lungeTime: 0.6, speed: 50 },
  /** Aisle 4 rolls one variant (flow.rng): a giant per theme with its own move numbers / loop / shot. */
  variants: [
    { // 1: the stampeder
      byTheme: { main: 'soda', frozen: 'turkey', bakery: 'baguette', electronics: 'spitter', checkout: 'banana' } as Partial<Record<DepartmentId, EnemyId>>,
      kit: { cycle: BOSS_CYCLE, shot: 'proj_receipt', moves: { volleyCount: 5, volleySpreadDeg: 60, summonCount: 2 } } as BossKit,
      def: {} as Partial<EnemyDef>,
    },
    { // 2: the skirmisher: quicker, narrow bubble volleys, bigger families, short charges
      byTheme: { main: 'cereal', frozen: 'expired', bakery: 'egg', electronics: 'beans', checkout: 'gum' } as Partial<Record<DepartmentId, EnemyId>>,
      kit: { cycle: ['volley', 'summon', 'charge', 'volley', 'summon'], shot: 'proj_bubble', moves: { volleyCount: 3, volleySpreadDeg: 26, summonCount: 4 } } as BossKit,
      def: { speed: 64, attackCooldown: 2.3, projectileSpeed: 230, lungeSpeed: 520, lungeTime: 0.5 } as Partial<EnemyDef>,
    },
  ],
  /** Crates: one legendary (when any is unlocked), the rest weapons at this tier. */
  crates: 3,
  weaponTier: 2,
};
export type MiniVariant = (typeof MINI_BOSS.variants)[number];

/**
 * The def of a mid-shift giant: its base grocery with the Manager's behavior (every boss check keys on `behavior`), the giant's move numbers and
 * the variant's overrides. The merge starts from `base`, so the giant keeps its grocery's `weak` and `resist` (a Frozen Turkey giant is still weak
 * to heat): neither `MINI_BOSS.def` nor a variant's `def` names them. `dm` is the aisle's damage scale.
 */
export const miniBossDef = (base: EnemyDef, mini: MiniVariant, dm = 1): EnemyDef => ({
  ...base, ...MINI_BOSS.def, ...mini.def, behavior: 'boss' as const, radius: base.radius * MINI_BOSS.scale,
  contactDamage: Math.round(MINI_BOSS.def.contactDamage * dm), attackDamage: Math.round(MINI_BOSS.def.attackDamage * dm),
});

/**
 * Elite groceries: tougher, bigger, gold-ringed, pay more. Rolled per spawn; never boss/slice/egg.
 * chanceByAisle[i] is the chance in aisle i+1 (regular aisles only); overtime uses overtimeChance;
 * each shift adds shiftBonus.
 */
export const ELITE = { hpMult: 3.5, scale: 1.35, contactMult: 1.5, coinMult: 3, chanceByAisle: [0, 0, 0.05, 0.08, 0.11, 0.14, 0.17], overtimeChance: 0.3, shiftBonus: 0.03 };
export const ELITE_EXCLUDED: EnemyId[] = [...BOSS_IDS, 'slice', 'egg', 'giftcard'];

/** Every Elite rolls one affix. Splitter skips types that already split or are tiny. */
export type EliteAffix = 'swift' | 'tough' | 'splitter' | 'pickpocket' | 'plated';
export const ELITE_AFFIXES: EliteAffix[] = ['swift', 'tough', 'splitter', 'pickpocket', 'plated'];
export const SPLITTER_EXCLUDED: EnemyId[] = ['melon', 'slice', 'honey'];
export const AFFIX = {
  swift: { speedMult: 1.4, color: 0x7cc4e8 },
  tough: { regenPct: 0.02, idle: 2, color: 0x8fcb57 },                     // % max HP per second after `idle` s without being hit
  splitter: { count: 2, scale: 0.4, hpMult: 0.4, color: 0xb08ae0 },         // copies at 40% scale / HP of the base type
  pickpocket: { radius: 170, absorbRadius: 26, color: 0xf45f52 }, // px
  plated: { armor: 3, color: 0xaab2c2 },                                   // flat armor on top of the type's own (same rule as Canned Beans; Shred strips it)
};

/** The armor an elite with this affix has: its type's own, plus the Plated affix's (`AFFIX.plated.armor`). Every other affix leaves it as it is. */
export const affixArmor = (armor: number | undefined, affix?: EliteAffix): number | undefined => (affix === 'plated' ? (armor ?? 0) + AFFIX.plated.armor : armor);

/** Health bars appear on these enemies once damaged (never at full HP, to avoid clutter): the content files with `hpBar`. */
export const SHOW_HP_BAR: EnemyId[] = ENEMY_ORDER.filter((id) => content(id).hpBar);
