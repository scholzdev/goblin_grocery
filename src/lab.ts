import { ECONOMY } from './data/waves';
import type { LabOpts } from './types';

/** Test Lab gate: launch with `--lab` (desktop) or `?lab=1` (web). Works in any build. */
export const LAB = new URLSearchParams(location.search).has('lab');

const KEY = 'goblin-grocery.lab.v1';
export const LAB_DEFAULTS: LabOpts = { aisle: 1, dept: 'main', shift: 0, starter: 'toaster', weapon: 'toaster', money: 999, cart: [5, 4], shelf: ECONOMY.shelfSlots, shopLevel: 1, god: false, keep: true, event: 'random', mod: 'none' };

export function loadLab(): LabOpts {
  try { return { ...LAB_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...LAB_DEFAULTS }; }
}

export function saveLab(o: LabOpts): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage unavailable */ }
}
