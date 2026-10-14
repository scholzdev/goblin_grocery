import type { EnemyId, ItemTypeId, RecipeId, RunState, StarterId } from '../types';
import { STARTING_ITEMS, UNLOCKS, type CartSkin, type GoblinSkin, type ProfileStats, type Unlock } from '../data/unlocks';
import { BOSS_WAVE, SHIFTS } from '../data/waves';

// Persistent meta-progression (localStorage). Every access is guarded: a blocked storage just means
// progress isn't kept between sessions; the game itself never depends on it.

export interface Profile {
  v: 1;
  stats: ProfileStats;
  recipes: RecipeId[];   // discovered combos
  unlocked: string[];    // ids from UNLOCKS
  goblin: GoblinSkin;
  cart: CartSkin;
  enemies: Partial<Record<EnemyId, { seen: number; kills: number; elites: number }>>;
}

const KEY = 'goblin-grocery.profile.v1';
const fresh = (): Profile => ({
  v: 1,
  stats: { runs: 0, wins: 0, losses: 0, kills: 0, coins: 0, bestWave: 0, combos: 0, deptClears: {}, bestShift: {}, bestOvertime: 0 },
  recipes: [], unlocked: [], goblin: 'classic', cart: 'chrome', enemies: {},
});

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw) as Profile;
    const f = fresh();
    return { ...f, ...p, stats: { ...f.stats, ...p.stats, deptClears: { ...p.stats?.deptClears }, bestShift: { ...p.stats?.bestShift } }, enemies: { ...p.enemies } };
  } catch {
    return fresh();
  }
}

export const profile: Profile = load();

export function saveProfile(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage blocked */
  }
}

export const isUnlocked = (u: Unlock): boolean => profile.unlocked.includes(u.id);

/** Items that may appear in shops this run. */
export function unlockedItems(): ItemTypeId[] {
  const extra = UNLOCKS.flatMap((u) => (u.kind === 'item' && isUnlocked(u) ? [u.item] : []));
  return [...new Set([...STARTING_ITEMS, ...extra])];
}

export const goblinUnlocked = (skin: GoblinSkin): boolean =>
  skin === 'classic' || UNLOCKS.some((u) => u.kind === 'goblin' && u.skin === skin && isUnlocked(u));
/** Toaster and pan are always open; the other starters come from UNLOCKS. */
export const starterUnlocked = (id: StarterId): boolean =>
  !UNLOCKS.some((u) => u.kind === 'starter' && u.starter === id) || UNLOCKS.some((u) => u.kind === 'starter' && u.starter === id && isUnlocked(u));
export const cartUnlocked = (skin: CartSkin): boolean =>
  skin === 'chrome' || UNLOCKS.some((u) => u.kind === 'cart' && u.skin === skin && isUnlocked(u));

/** Marks a combo as discovered. Returns true the first time. */
export function discoverRecipe(id: RecipeId): boolean {
  if (profile.recipes.includes(id)) return false;
  profile.recipes.push(id);
  profile.stats.combos = profile.recipes.length;
  saveProfile();
  return true;
}

/** First sighting of an enemy type persists immediately; kills are counted in memory and flushed by recordRun. Lab runs are ignored. */
export function noteEnemy(s: RunState, id: EnemyId, kill?: { elite: boolean }): void {
  if (s.lab) return;
  const e = (profile.enemies[id] ??= { seen: 0, kills: 0, elites: 0 });
  if (kill) { e.kills++; if (kill.elite) e.elites++; return; }
  if (e.seen) return;
  e.seen = 1;
  saveProfile();
}

/** Checks every unlock against current stats; returns the ones newly earned. */
export function evaluateUnlocks(): Unlock[] {
  const fresh = UNLOCKS.filter((u) => !isUnlocked(u) && u.check(profile.stats));
  for (const u of fresh) profile.unlocked.push(u.id);
  if (fresh.length) saveProfile();
  return fresh;
}

/** Folds a finished run into lifetime stats and returns anything it unlocked. */
export function recordRun(s: RunState, won: boolean): Unlock[] {
  const st = profile.stats;
  st.runs++;
  if (won) st.wins++; else st.losses++;
  st.kills += s.stats.kills;
  st.coins += s.stats.coinsEarned;
  st.bestWave = Math.max(st.bestWave, won ? BOSS_WAVE : s.wave);
  // route[i] is the department of aisle i+1; the first `wavesCleared` aisles were cleared.
  s.route.slice(0, s.stats.wavesCleared).forEach((d) => (st.deptClears[d] = (st.deptClears[d] ?? 0) + 1));
  if (won) {
    st.deptClears.boss = (st.deptClears.boss ?? 0) + 1;
    st.bestShift[s.starter] = Math.max(st.bestShift[s.starter] ?? 0, s.shift);
  }
  saveProfile();
  return evaluateUnlocks();
}

/** Shift `n` (0-based) is open for a starter once the previous shift was won with it. */
export const shiftUnlocked = (starter: string, n: number): boolean => n <= 0 || n < SHIFTS.length && (profile.stats.bestShift[starter] ?? -1) >= n - 1;

/** Overtime defeat: only the new best is tracked (the run itself was counted at victory). */
export function recordOvertime(aisles: number): void {
  profile.stats.bestOvertime = Math.max(profile.stats.bestOvertime, aisles);
  saveProfile();
}
