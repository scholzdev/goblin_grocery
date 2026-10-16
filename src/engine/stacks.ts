// Pure helpers for timed stacks (Sugar Rush). No imports: content files may use this module next to `engine/define`, and the
// engine gates (`systems/combat` re-exports `tailwindFeedsSugar` for the old tests).

/** The stacks still running at `now` (a list of expiry times, in seconds). */
export const liveStacks = (list: readonly number[], now: number): number[] => list.filter((t) => t > now);

/** How many stacks run at `now` (no allocation: the speed multiplier asks every frame). */
export const countStacks = (list: readonly number[], now: number): number => { let n = 0; for (const t of list) if (t > now) n++; return n; };

/**
 * +1 stack with its own expiry. Expired stacks are dropped and the rest sorted by expiry; at the cap the oldest stack is refreshed
 * instead of adding a new one. Mutates `list`.
 */
export function pushStack(list: number[], now: number, duration: number, max: number): void {
  const live = liveStacks(list, now).sort((a, b) => a - b);
  if (live.length >= max) live[0] = now + duration;
  else live.push(now + duration);
  list.length = 0;
  list.push(...live);
}

/** Tailwind gating: a blast only feeds Sugar Rush when Sugar Rush is active and the internal cooldown has passed. */
export const tailwindFeedsSugar = (sugarActive: boolean, now: number, lastFeed: number, icd: number): boolean => sugarActive && now - lastFeed >= icd;
