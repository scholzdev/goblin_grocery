import { applyPoison, shredStacks, type StatusFx } from '../systems/combat';
import { recordReaction, type DamageSink } from '../systems/damageStats';
import type { UIKey } from '../i18n';
import { poisonTimeFor } from './affinity';
import type { CombatEnemy, RuntimeCtx } from './ctx';
import { ELEMENT_COLORS } from './damageType';
import { REACTIONS, SHRED, WET_STATUS, type AffinityTag, type ReactionId } from './define';
import type { HitOpts } from './hooks';
import { Set as S } from './ids';
import { contentSetTune } from './registry';
import { isWet } from './wet';

// Element reactions (docs/item-hooks-refactor.md "Reactions"). A hit or a status application that meets a status already on the enemy sets off a burst:
//
//   Shatter  burn + frosted      a burst on the enemy, eats the burn and the frost slow / freeze
//   Fumes    burn + poison       a poison cloud that poisons the OTHER enemies around it, eats the burn
//   Conduct  wet + electric hit  a chain of hits along the nearest enemies, eats the Wet
//   Crack    shred at the cap + blast hit   shrapnel to the nearest enemies (+1 Shred each), eats the Shred
//   Ice Sheet  wet (not from this frame) + frost hit that did not freeze   the enemy slides helplessly, a slam when it hits a wall, a prop or another enemy; eats the Wet
//   Detonate poisoned + blast hit   eats the poison, a burst of its dps x the seconds it had left around the enemy
//
// The rules live here once; `PhaserCtx` and `FakeCtx` each own a `Reactor` and call it from the same three places (a status application, the start and the end of a
// hit), so the arena, the sims and the tests run the same code. No rng: a reaction is always the same for the same state. Pure over the `RuntimeCtx` (damage, fx, clock).

/** The label pop and the breakdown name of each reaction (`i18n/ui.ts`). */
export const REACTION_TEXT: Readonly<Record<ReactionId, { label: UIKey; name: UIKey }>> = {
  shatter: { label: 'reactShatter', name: 'rnShatter' },
  fumes: { label: 'reactFumes', name: 'rnFumes' },
  conduct: { label: 'reactConduct', name: 'rnConduct' },
  crack: { label: 'reactCrack', name: 'rnCrack' },
  iceSheet: { label: 'reactIceSheet', name: 'rnIceSheet' },
  detonate: { label: 'reactDetonate', name: 'rnDetonate' },
};

/** The `damageByWeapon` key of a reaction's burst hits (`HitOpts.label`). */
export const REACTION_LABEL: Readonly<Record<ReactionId, string>> = { shatter: 'Shatter', fumes: 'Toxic Fumes', conduct: 'Conduct', crack: 'Crack', iceSheet: 'Ice Sheet', detonate: 'Detonate' };
const LABEL = REACTION_LABEL;

const EPS = 1e-9;

// ---- the status rules (pure, over a StatusFx) ---------------------------------------------------------------------------

/** Burning right now. */
export const isBurning = (s: StatusFx, now: number): boolean => s.burnUntil > now && s.burnDps > 0;
/** Poisoned right now. */
export const isPoisoned = (s: StatusFx, now: number): boolean => s.poisonUntil > now && s.poisonDps > 0;
/**
 * Frosted: a slow that came from a frost source (`applySlow(..., frost = true)`, i.e. the stats-driven `ctx.slow`: Ice Pack, Jelly frost, Cold Storage, Brain Freeze) or a
 * frost-tagged stun (Frost set freeze, Black Ice, Frostbite Nails; `markFrostStun`) is running. The soap puddle and the wet-floor slow do not count.
 */
export const isFrosted = (s: StatusFx, now: number): boolean => s.frostUntil > now;
/** A frost-tagged stun of `seconds` was applied: the enemy counts as frosted for as long. */
export function markFrostStun(s: StatusFx, seconds: number, now: number): void {
  s.frostUntil = Math.max(s.frostUntil, now + seconds);
}
/** Is the per-enemy reaction cooldown (shared by all of them) over. */
export const reactionReady = (s: StatusFx, now: number): boolean => now >= s.reactionCdUntil - EPS;
/** Is Shatter's own, longer per-enemy cooldown over (on top of the shared one). */
export const shatterReady = (s: StatusFx, now: number): boolean => now >= s.shatterCdUntil - EPS;

/**
 * Wet from before: the Wet is running and was not applied this very frame. The Spray, the Mop and the Snow Cone Machine soak and then hit with frost in the same frame, so
 * their own hit never counts: Ice Sheet needs a frost hit that comes after the Wet, and the Spray's Wet stays for the Laser's Conduct. A Wet longer than `WET_STATUS.duration`
 * (Thunderstorm's) cannot be told from a fresh one and never counts either: it only ever holds a reaction back.
 */
export const soakedBefore = (s: StatusFx, now: number): boolean => s.wetUntil > now && s.wetUntil - now < WET_STATUS.duration - EPS;
/** Frozen right now: a frost-tagged stun is running (`markFrostStun`). A frost slow alone is not a freeze. */
export const isFrozen = (e: CombatEnemy, now: number): boolean => e.state === 'stun' && e.status.frostUntil > now;

/** Shatter eats the burn. */
export function consumeBurn(s: StatusFx): void {
  s.burnDps = 0; s.burnUntil = 0; s.nextBurnAt = 0;
}

/**
 * Shatter eats the frost: the frost mark, the slow it belongs to (a longer slow from another source stays) and the freeze (the ice block and the frost stun; a boss
 * has no stun to cut). The ice block's own fade-out (`frozenT` run out) breaks it on screen.
 */
export function consumeFrost(e: CombatEnemy, now: number): void {
  const s = e.status;
  if (s.slowUntil <= s.frostUntil + EPS) { s.slowPct = 0; s.slowUntil = 0; }
  if (e.frozenT && e.frozenT > 0) e.frozenT = Math.min(e.frozenT, 0.001);
  if (e.def.behavior !== 'boss' && e.state === 'stun' && (e.stateT ?? 0) <= s.frostUntil - now + EPS) e.stateT = 0;
  s.frostUntil = 0;
}

/** Fumes: poison the other enemies of the cloud. Not an application event (it never sets off a reaction itself). */
function poisonCloud(ctx: RuntimeCtx, at: { x: number; y: number }, src: CombatEnemy, dps: number): void {
  const R = REACTIONS.fumes;
  for (const o of ctx.inRadius(at, R.radius)) if (o !== src && o.alive) applyPoison(o.status, dps, poisonTimeFor(o.def, R.poisonDuration), ctx.now());
  ctx.fx.puff(at.x, at.y - 10, 3);
  ctx.fx.ring('fx_pulse', at.x, at.y, R.radius * 2.2, 420, 0x8fcb57);
}

// ---- the reactor ------------------------------------------------------------------------------------------------------------

/** The statuses whose application can set a reaction off. */
export type AppliedStatus = 'burn' | 'frost' | 'poison';
const BIT: Readonly<Record<AppliedStatus, number>> = { burn: 1, frost: 2, poison: 4 };

/** A hit in flight on one enemy (`Reactor.begin`): the statuses applied to it so far. */
export interface OpenHit { readonly enemy: CombatEnemy; fresh: number }
/** What a reaction needs of the hit that set it off: its final damage (after armor) and its tags. */
export interface TriggerHit { dmg: number; tags: readonly AffinityTag[] }

/**
 * One per ctx. A status application is checked exactly once: inside a hit on that enemy (`begin` .. `end`) it is only noted and the hit's end checks it; outside a
 * hit (a puddle or aura tick, a hook) it is checked at once with no hit damage (Shatter's burst is then its flat part only). A reaction's own burst hits are flagged
 * (`HitOpts.reaction`), never open a hit and apply no status, so they cannot set another reaction off.
 *
 * Order when several apply to the same trigger: Shatter, Fumes, Conduct, Detonate, Crack, Ice Sheet. One per enemy per `REACTIONS.cooldown`; a blocked trigger is lost. Shatter also waits
 * `REACTIONS.shatter.cooldown` after its own last one on that enemy; while it waits, the others can still go off once the shared cooldown allows. A new burn on a wet enemy
 * steams first (`burnVsWet` dries it in the application), so by the time the hit ends the Wet is gone and Conduct cannot fire.
 */
export class Reactor {
  private readonly open: OpenHit[] = [];

  constructor(private readonly ctx: RuntimeCtx, private readonly stats: () => Pick<DamageSink, 'damage'>) {}

  /** A hit on `e` starts. Null for a reaction's own burst. */
  begin(e: CombatEnemy, o: HitOpts): OpenHit | null {
    if (o.reaction) return null;
    const h: OpenHit = { enemy: e, fresh: 0 };
    this.open.push(h);
    return h;
  }

  /** A burn, a frost slow / freeze or a poison was just applied to `e`. */
  applied(e: CombatEnemy, kind: AppliedStatus): void {
    for (let i = this.open.length - 1; i >= 0; i--) if (this.open[i].enemy === e) { this.open[i].fresh |= BIT[kind]; return; }
    this.run(e, BIT[kind], null);
  }

  /** The hit is over (its statuses, `afterHit` hooks done): check what it applied and what it is. `hit.dmg` is the final damage. */
  end(h: OpenHit | null, hit: TriggerHit): void {
    if (!h) return;
    this.open.splice(this.open.lastIndexOf(h), 1);
    this.run(h.enemy, h.fresh, hit);
  }

  private run(e: CombatEnemy, fresh: number, hit: TriggerHit | null): void {
    const ctx = this.ctx, now = ctx.now(), s = e.status;
    if (!e.alive || e.state === 'spawn' || e.state === 'dying' || !reactionReady(s, now)) return;
    const burning = isBurning(s, now), poisoned = isPoisoned(s, now);
    let id: ReactionId | null = null;
    if (e.hp > 0 && burning && isFrosted(s, now) && fresh & (BIT.burn | BIT.frost) && shatterReady(s, now)) id = 'shatter'; // (a burst on a corpse would do nothing: the hit that kills takes no Shatter, the others still go off)
    else if (burning && poisoned && fresh & (BIT.burn | BIT.poison)) id = 'fumes';
    else if (hit && isWet(s, now) && hit.tags.includes('electric')) id = 'conduct';
    else if (hit && poisoned && hit.tags.includes('blast')) id = 'detonate'; // before Crack: every blast hit also shreds, so Crack's own shrapnel keeps a bunch at the cap and would always win
    else if (hit && shredStacks(s, now) >= SHRED.cap && hit.tags.includes('blast')) id = 'crack';
    else if (hit && e.hp > 0 && e.def.behavior !== 'boss' && soakedBefore(s, now) && (hit.tags.includes('frost') || fresh & BIT.frost) && !isFrozen(e, now)) id = 'iceSheet'; // (a freeze comes first: a frozen enemy cannot slide; a corpse and a boss have nothing to slide)
    if (!id) return;

    s.reactionCdUntil = now + REACTIONS.cooldown;
    if (id === 'shatter') s.shatterCdUntil = now + REACTIONS.shatter.cooldown;
    recordReaction(this.stats(), id);
    ctx.fx.label(e.x, e.y - 80, ctx.t(REACTION_TEXT[id].label), ELEMENT_COLORS.reaction, 24);
    if (id === 'shatter') this.shatter(e, hit);
    else if (id === 'fumes') this.fumes(e);
    else if (id === 'conduct') this.conduct(e, hit!);
    else if (id === 'crack') this.crack(e, hit!);
    else if (id === 'iceSheet') this.iceSheet(e);
    else this.detonate(e);
  }

  /** The burst is `flat` + `share` of the triggering hit (just the flat part when a status application with no hit set it off); heat + frost for the affinity. */
  private shatter(e: CombatEnemy, hit: TriggerHit | null): void {
    const ctx = this.ctx, R = REACTIONS.shatter;
    consumeBurn(e.status);
    consumeFrost(e, ctx.now());
    ctx.fx.frostBurst(e.x, e.y - 20, 8);
    for (let i = 0; i < 3; i++) ctx.fx.flame(e.x - 14 + i * 14, e.y - 24 - i * 6);
    ctx.fx.spark(e.x, e.y - 30, 6, 0xcff3ff);
    ctx.sound('frost', { rate: 1.5, volume: 0.6 });
    ctx.damage(e, R.flat + R.share * (hit?.dmg ?? 0), null, { reaction: 'shatter', tags: ['heat', 'frost'], label: LABEL.shatter });
  }

  /** The cloud sits where the enemy was, ticks at once and then every `tick` s for `duration` s, and carries the source's current poison dps. */
  private fumes(e: CombatEnemy): void {
    const ctx = this.ctx, R = REACTIONS.fumes, dps = e.status.poisonDps, at = { x: e.x, y: e.y };
    consumeBurn(e.status);
    poisonCloud(ctx, at, e, dps);
    for (let t = R.tick; t < R.duration - EPS; t += R.tick) ctx.delay(t, () => { if (ctx.combatActive()) poisonCloud(ctx, at, e, dps); });
  }

  /** `hops` hits of `share` of the triggering hit along the nearest enemies not hit yet (the Electric set's chain range); the Wet goes after the triggering hit already got its bonus. */
  private conduct(e: CombatEnemy, hit: TriggerHit): void {
    const ctx = this.ctx, R = REACTIONS.conduct, range = contentSetTune(S.electric, 1).range;
    e.status.wetUntil = 0;
    const seen = new Set<number>([e.id]), pts = [{ x: e.x, y: e.y - 30 }];
    let from = e;
    for (let j = 0; j < R.hops; j++) {
      const n = ctx.ricochetTarget(from, seen, range);
      if (!n) break;
      seen.add(n.id);
      pts.push({ x: n.x, y: n.y - 30 });
      ctx.fx.spark(n.x, n.y - 30, 4, 0x9be8ff);
      ctx.damage(n, R.share * hit.dmg, null, { reaction: 'conduct', tags: ['electric'], label: LABEL.conduct });
      from = n;
    }
    if (pts.length > 1) ctx.arcFx(pts);
  }

  /** Shrapnel to the `targets` nearest other enemies within `radius` of the cracked one: `share` of the triggering hit and `shred` stacks each. The cracked one loses its stacks. */
  private crack(e: CombatEnemy, hit: TriggerHit): void {
    const ctx = this.ctx, R = REACTIONS.crack;
    e.status.shredStacks = 0; e.status.shredUntil = 0;
    const near = ctx.alive()
      .filter((o) => o !== e && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= R.radius * R.radius)
      .map((o) => ({ o, d: (o.x - e.x) ** 2 + (o.y - e.y) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, R.targets);
    ctx.fx.ring('fx_pulse', e.x, e.y, R.radius * 1.4, 260, 0xffb066);
    ctx.fx.spark(e.x, e.y - 30, 6, 0xffb066);
    for (const { o } of near) {
      ctx.fx.streak(e.x, e.y - 24, o.x, o.y - 24, 0xffb066);
      ctx.damage(o, R.share * hit.dmg, null, { reaction: 'crack', label: LABEL.crack });
      if (o.alive) ctx.shred(o, R.shred);
    }
  }

  /** The Wet goes (the enemy is on the ice now); the slide and its slam are the ctx's (`ctx.slide`, the Leaf Blower's slam). */
  private iceSheet(e: CombatEnemy): void {
    const ctx = this.ctx, R = REACTIONS.iceSheet;
    e.status.wetUntil = 0;
    ctx.fx.frostBurst(e.x, e.y - 10, 6);
    ctx.fx.ring('fx_pulse', e.x, e.y, 90, 320, 0xbfe8ff);
    ctx.sound('frost', { rate: 1.2, volume: 0.6 });
    ctx.slide(e, R.slide, R.slam, R.speed);
  }

  /** The poison goes and what it had left (dps x seconds) bursts on everything within `radius` of the enemy, itself included. */
  private detonate(e: CombatEnemy): void {
    const ctx = this.ctx, R = REACTIONS.detonate, s = e.status;
    const dmg = s.poisonDps * (s.poisonUntil - ctx.now()), at = { x: e.x, y: e.y };
    s.poisonDps = 0; s.poisonUntil = 0; s.nextPoisonAt = 0;
    ctx.fx.puff(at.x, at.y - 20, 4);
    ctx.fx.ring('fx_pulse', at.x, at.y, R.radius * 2, 320, 0x8fcb57);
    ctx.fx.shake(0.003, 80);
    ctx.sound('boom', { rate: 1.4, volume: 0.5 });
    ctx.damageArea(at, R.radius, dmg, null, { reaction: 'detonate', tags: ['blast', 'poison'], label: LABEL.detonate });
  }
}
