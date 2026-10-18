import { ECONOMY } from './data/waves';
import type { EliteAffix } from './data/enemies';
import type { SpreadKind } from './systems/spread';
import type { EnemyId, LabOpts } from './types';

const QUERY = new URLSearchParams(location.search);
/** `?sim=<id>`: boot straight into that sim (see src/sims). Null when the parameter is absent. */
export const SIM_PARAM: string | null = QUERY.get('sim');
/** Test Lab gate: launch with `--lab` (desktop) or `?lab=1` (web); a sim launch (`?sim=`) turns the lab features on too. Works in any build. */
export const LAB = QUERY.has('lab') || QUERY.has('sim');
/** Dev-only autoplayer (src/bot): `?bot=1` on the dev server. Its runs never touch the profile or the best receipts. */
export const BOT = import.meta.env.DEV && QUERY.has('bot');

const KEY = 'goblin-grocery.lab.v1';
export const LAB_DEFAULTS: LabOpts = { aisle: 1, dept: 'main', shift: 0, starter: 'toaster', weapon: 'toaster', money: 999, cart: [4, 4], shelf: ECONOMY.shelfSlots, shopLevel: 1, god: false, keep: true, event: 'random', mod: 'none', sandbox: false };

/**
 * Sandbox dummy spec; `mini` = MINI_BOSS variant index. Kept across shop ↔ arena swaps so the dummies come back.
 * `affix` (sims): spawn as an elite, 'elite' = a random affix. `place` (sims): where it spawns; `at` = fixed spot or group centre,
 * `spread` = layout of its group (`slot` of `of`; dummies with the same `group` share one centre).
 */
export interface LabDummy {
  id: EnemyId; still: boolean; immortal: boolean; mini?: number;
  affix?: EliteAffix | 'elite';
  place?: { at?: [number, number]; spread: SpreadKind; slot: number; of: number; group: number };
}
export const labDummies: LabDummy[] = [];

export function loadLab(): LabOpts {
  try { return { ...LAB_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...LAB_DEFAULTS }; }
}

export function saveLab(o: LabOpts): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage unavailable */ }
}
