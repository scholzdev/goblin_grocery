import { MINI_BOSS } from '../data/enemies';
import { BOSS_WAVE } from '../data/waves';
import type { Inventory, ItemInstance, RunState } from '../types';

// Shortcut Key (docs/new-items-plan.md "Shortcut"): once per run, the door screen after a shop offers a "Staff Only" door that skips the next aisle.

export const KEY_ITEM = 'shortcut';
export const SPENT_ITEM = 'spentkey';

/** The unused key in the cart or on the shelf. */
export const findKey = (inv: Inventory): ItemInstance | null =>
  [...inv.placed, ...inv.shelf].find((i): i is ItemInstance => !!i && i.type === KEY_ITEM) ?? null;

/**
 * May the aisle after `cleared` be skipped? Never the mini-boss aisle or the boss aisle, never in overtime (the Test Lab and sims do offer it), and only while a key is unused.
 * Skipping the aisle before the boss is fine: you land on the boss aisle at full health.
 */
export const canShortcut = (state: Pick<RunState, 'inventory' | 'overtime'>, cleared: number): boolean => {
  const skipped = cleared + 1;
  return !state.overtime && skipped !== MINI_BOSS.aisle && skipped < BOSS_WAVE && !!findKey(state.inventory);
};

/** The key turns into a spent key (a 1x1 item worth 1 coin). */
export function spendKey(inv: Inventory): void {
  const k = findKey(inv);
  if (k) k.type = SPENT_ITEM;
}

/** Door choice for the bots: they take the Staff Only door only when hurt (below this share of max HP), otherwise it is not an option. */
export const BOT_SHORTCUT_HP = 0.35;
export function botDoors<D extends string>(doors: D[], state: Pick<RunState, 'hp' | 'build'>): D[] {
  const has = doors.includes('shortcut' as D);
  if (has && state.hp < state.build.maxHp * BOT_SHORTCUT_HP) return ['shortcut' as D];
  return has ? doors.filter((d) => d !== 'shortcut') : doors;
}
