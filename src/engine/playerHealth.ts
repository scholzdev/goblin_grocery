import type { Build, ItemTypeId } from '../types';

/** Shared by combat, shops, aisle rewards and the headless engine. Max-HP increases never count as healing. */
export function healPlayer(state: { hp: number; shield?: number }, build: Pick<Build, 'maxHp' | 'overhealShieldCap'>, amount: number): void {
  if (state.hp <= 0 || !(amount > 0)) return;
  const missing = Math.max(0, build.maxHp - state.hp);
  state.hp = Math.min(build.maxHp, state.hp + amount);
  const cap = build.overhealShieldCap ?? 0;
  if (cap > 0) state.shield = Math.min(cap, (state.shield ?? 0) + Math.max(0, amount - missing));
}

/** Return the damage left after the shield; no HP or hit statistics are changed here. */
export function absorbShield(state: { shield?: number }, damage: number): number {
  const absorbed = Math.min(Math.max(0, state.shield ?? 0), Math.max(0, damage));
  state.shield = Math.max(0, (state.shield ?? 0) - absorbed);
  return Math.max(0, damage - absorbed);
}

export function useRunOnce(state: { itemUses?: Partial<Record<ItemTypeId, boolean>> }, id: ItemTypeId): boolean {
  if (state.itemUses?.[id]) return false;
  (state.itemUses ??= {})[id] = true;
  return true;
}

/** Boots reduce the strength of a floor slow, without affecting ordinary movement bonuses or dash speed. */
export const floorSpeed = (mult: number, resist = 0): number => 1 - (1 - mult) * (1 - Math.max(0, Math.min(1, resist)));
