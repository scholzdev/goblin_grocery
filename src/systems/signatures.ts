import { SIGNATURE, signatureOf } from '../data/items';
import type { StarterId } from '../types';

// The two goblin signatures that act inside the fight (the other two are in state/run: Line Cook's merge heal, Coupon Clipper's free reroll). Pure; the arena calls them.

/** Toast Goblin: true the first time `weaponUid` lands a direct hit this aisle (`seen` is the aisle's set, filled here). */
export function firstHitCrit(starter: StarterId | undefined, seen: Set<string>, weaponUid: string): boolean {
  if (signatureOf(starter) !== 'firstCrit' || seen.has(weaponUid)) return false;
  seen.add(weaponUid);
  return true;
}

/** Night Shift: the dash cooldown left after a dash kill (unchanged for any other goblin or any other kill). */
export function dashCooldownAfterKill(starter: StarterId | undefined, shoveCd: number, dashKill: boolean): number {
  return dashKill && signatureOf(starter) === 'dashCooldown' ? Math.max(0, shoveCd - SIGNATURE.dashCooldown.cut) : shoveCd;
}
