import type { DepartmentId, EnemyId, ItemTypeId, RecipeId, RunState, SetId, StarterId } from '../types';
import { STARTING_ITEMS, UNLOCKS, type CartSkin, type GoblinSkin, type ProfileStats, type Unlock } from '../data/unlocks';
import { BOSS_WAVE, SHIFTS } from '../data/waves';
import { setLevels } from '../data/sets';

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
  seen: string[];        // catalog entries already viewed (`item:x`, `recipe:x`, `enemy:x`)
  history: HistoryEntry[]; // last runs, newest first
  stamps: number;        // loyalty card progress 0-9
  coupons: number;       // pending +20 coin vouchers
  daily: { date: string; best: number; tries: number };
}

/** One line of the receipt history ("Bons"). */
export interface HistoryEntry {
  t: number; win: boolean; aisle: number; score: number; shift: number; starter: StarterId;
  daily?: boolean; items: ItemTypeId[]; sets: { id: SetId; lv: number }[];
}
export const HISTORY_MAX = 10, STAMPS_PER_CARD = 10, COUPON_COINS = 20;

/** Local calendar day, 'YYYY-MM-DD'. */
export const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Same seed for everybody on a given day (FNV-1a over the date string). */
export const dailySeed = (key = todayKey()): number => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
};
/** Today's best daily score (0 = not played yet today). */
export const dailyBestToday = (): number => (profile.daily.date === todayKey() ? profile.daily.best : 0);

const KEY = 'goblin-grocery.profile.v1';
const fresh = (): Profile => ({
  v: 1,
  stats: { runs: 0, wins: 0, losses: 0, kills: 0, coins: 0, bestWave: 0, combos: 0, deptClears: {}, bestShift: {}, bestOvertime: 0 },
  recipes: [], unlocked: [], goblin: 'classic', cart: 'chrome', enemies: {}, seen: [],
  history: [], stamps: 0, coupons: 0, daily: { date: '', best: 0, tries: 0 },
});

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw) as Profile;
    const f = fresh();
    return { ...f, ...p, stats: { ...f.stats, ...p.stats, deptClears: { ...p.stats?.deptClears }, bestShift: { ...p.stats?.bestShift } }, enemies: { ...p.enemies }, seen: [...(p.seen ?? [])], history: [...(p.history ?? [])], daily: { ...f.daily, ...p.daily } };
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

/** First sighting of an enemy type persists immediately; kills are counted in memory and flushed by recordRun. Lab and bot runs are ignored. */
export function noteEnemy(s: RunState, id: EnemyId, kill?: { elite: boolean }): void {
  if (s.lab || s.bot) return;
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
  // route[i] is the department of aisle i+1; the first `wavesCleared` aisles that were played (not skipped by a Staff Only door) were cleared.
  // The boss aisle is counted from `won` below: victory sets wavesCleared to BOSS_WAVE - 1 even when a skip left fewer aisles before it.
  const bump = (d: string) => (st.deptClears[d as DepartmentId] = (st.deptClears[d as DepartmentId] ?? 0) + 1);
  s.route.map((d, i) => ({ d, m: s.mods[i], aisle: i + 1 })).filter((a) => a.d !== 'boss' && !s.skippedAisles?.includes(a.aisle)).slice(0, s.stats.wavesCleared)
    .forEach(({ d, m }) => { bump(d); if (m === 'clearance') bump('clearance'); });
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

/** What a run added to the profile: unlock ids, discovered combos, first-sighted enemies. */
export interface Fresh { unlocks: string[]; recipes: RecipeId[]; enemies: EnemyId[] }
export interface Near { id: string; ratio: number; cur: number; need: number }
export const emptyFresh = (): Fresh => ({ unlocks: [], recipes: [], enemies: [] });
export type ProfileSnap = { unlocked: string[]; recipes: RecipeId[]; enemies: string[] };

const seenEnemies = () => (Object.keys(profile.enemies) as EnemyId[]).filter((e) => profile.enemies[e]?.seen);
export const snapProfile = (): ProfileSnap => ({ unlocked: [...profile.unlocked], recipes: [...profile.recipes], enemies: seenEnemies() });

/** Profile changes since `snap` (the sub-enemy 'slice' isn't worth a card); also queues them as NEW for the catalog. */
export function freshSince(snap: ProfileSnap): Fresh {
  const f: Fresh = {
    unlocks: profile.unlocked.filter((id) => !snap.unlocked.includes(id)),
    recipes: profile.recipes.filter((r) => !snap.recipes.includes(r)),
    enemies: seenEnemies().filter((e) => e !== 'slice' && !snap.enemies.includes(e)),
  };
  for (const id of f.unlocks) { const u = UNLOCKS.find((x) => x.id === id); if (u?.kind === 'item') pending.add(`item:${u.item}`); }
  f.recipes.forEach((r) => pending.add(`recipe:${r}`));
  f.enemies.forEach((e) => pending.add(`enemy:${e}`));
  return f;
}

/** The (up to 3) locked unlocks closest to done. */
export function nearUnlocks(): Near[] {
  return UNLOCKS.filter((u) => !isUnlocked(u)).map((u) => { const [cur, need] = u.progress(profile.stats); return { id: u.id, ratio: cur / need, cur, need }; })
    .filter((n) => n.ratio > 0 && n.ratio < 1).sort((a, b) => b.ratio - a.ratio).slice(0, 3);
}

/** Catalog entries earned but not yet viewed (kept across runs, not across reloads). */
const pending = new Set<string>();
export const isNew = (key: string): boolean => pending.has(key) && !profile.seen.includes(key);
export const newCount = (prefix = ''): number => [...pending].filter((k) => k.startsWith(prefix) && isNew(k)).length;
export function markSeen(prefix: string): void {
  const ks = [...pending].filter((k) => k.startsWith(prefix) && isNew(k));
  if (!ks.length) return;
  profile.seen.push(...ks);
  saveProfile();
}


const cartSummary = (s: RunState): Pick<HistoryEntry, 'items' | 'sets'> => ({
  items: [...new Set(s.inventory.placed.map((i) => i.type))].slice(0, 12),
  sets: (Object.entries(setLevels(s.inventory.placed)) as [SetId, number][]).filter(([, lv]) => lv >= 1).map(([id, lv]) => ({ id, lv })),
});

export interface Loyalty { before: number; gained: number; card: boolean }
export interface DailyResult { best: number; newBest: boolean }

/** Logs a finished (non-lab) run: receipt history, loyalty stamps, daily best. Overtime updates the victory entry instead. */
export function recordFinish(s: RunState, won: boolean, score: number): { loyalty?: Loyalty; daily?: DailyResult } {
  const entry: HistoryEntry = { t: Date.now(), win: won, aisle: s.wave, score, shift: s.shift, starter: s.starter, ...(s.daily ? { daily: true } : {}), ...cartSummary(s) };
  let loyalty: Loyalty | undefined;
  if (s.overtime && profile.history.length) {
    const h = profile.history[0];
    profile.history[0] = { ...h, aisle: s.wave, score: Math.max(h.score, score), ...cartSummary(s) };
  } else {
    profile.history.unshift(entry);
    profile.history.length = Math.min(profile.history.length, HISTORY_MAX);
    const before = profile.stamps, gained = won ? 2 : 1;
    profile.stamps += gained;
    const card = profile.stamps >= STAMPS_PER_CARD;
    if (card) { profile.stamps -= STAMPS_PER_CARD; profile.coupons++; }
    loyalty = { before, gained, card };
  }
  let daily: DailyResult | undefined;
  if (s.daily) {
    if (profile.daily.date !== todayKey()) profile.daily = { date: todayKey(), best: 0, tries: 1 };
    const newBest = score > profile.daily.best;
    if (newBest) profile.daily.best = score;
    daily = { best: profile.daily.best, newBest };
  }
  saveProfile();
  return { loyalty, daily };
}

/** Daily run starts count as tries; a stored date from yesterday resets the board. */
export function noteDailyStart(): void {
  if (profile.daily.date !== todayKey()) profile.daily = { date: todayKey(), best: 0, tries: 0 };
  profile.daily.tries++;
  saveProfile();
}

/** Spends one pending voucher; true when one was available. */
export function useCoupon(): boolean {
  if (profile.coupons <= 0) return false;
  profile.coupons--;
  saveProfile();
  return true;
}
