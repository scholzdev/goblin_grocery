import { ITEMS } from '../data/items';
import { adjacentPairs } from '../systems/inventory';
import { applySlow } from '../systems/combat';
import type { Inventory, WeaponFamily, WeaponStats } from '../types';
import type { CombatEnemy } from './ctx';
import type { HookSource } from './hooks';

export const PAIRINGS = {
  'hunter-spreader': 'overkill', 'hunter-primer': 'exploit', 'controller-hunter': 'pinpoint',
  'primer-spreader': 'contagion', 'controller-spreader': 'compression', 'controller-primer': 'hazard',
} as const;
export type WeaponPairing = typeof PAIRINGS[keyof typeof PAIRINGS];
export const pairingOf = (a: WeaponFamily, b: WeaponFamily): WeaponPairing | undefined =>
  PAIRINGS[[a, b].sort().join('-') as keyof typeof PAIRINGS];

/** One activation per family pairing. Multiple touching copies never multiply a bonus. */
export function weaponPairs(inv: Pick<Inventory, 'placed'>): { id: WeaponPairing; a: string; b: string }[] {
  const byUid = new Map(inv.placed.map((i) => [i.uid, ITEMS[i.type].weaponFamily]));
  return adjacentPairs(inv.placed).flatMap(([a, b]) => {
    const af = byUid.get(a), bf = byUid.get(b), id = af && bf && pairingOf(af, bf);
    return id ? [{ id, a, b }] : [];
  });
}

/** Compiled with the same lifecycle as item hooks; scratch marks expire with the aisle and cannot leak between pooled enemies. */
export function pairingSources(inv: Inventory): HookSource[] {
  const pairs = weaponPairs(inv);
  return [...new Set(pairs.map((p) => p.id))].map((id): HookSource => {
    const edges = pairs.filter((p) => p.id === id);
    const partners = (uid: string) => edges.flatMap((p) => p.a === uid ? [p.b] : p.b === uid ? [p.a] : []);
    const marks = new WeakMap<CombatEnemy['status'], Map<string, number>>();
    const control = new WeakMap<CombatEnemy['status'], Map<string, number>>();
    const stamp = (map: typeof marks, e: CombatEnemy, uid: string, until: number) => {
      const entries = map.get(e.status) ?? new Map<string, number>();
      entries.set(uid, Math.max(entries.get(uid) ?? 0, until)); map.set(e.status, entries);
    };
    const fromPartner = (map: typeof marks, e: CombatEnemy, uid: string, now: number) =>
      partners(uid).find((p) => (map.get(e.status)?.get(p) ?? 0) > now);
    const family = (s: WeaponStats) => ITEMS[s.type].weaponFamily;
    return {
      id: `pairing:${id}`, kind: 'pairing', tier: 1, weapons: null,
      hooks: {
        order: 900,
        modifyDamage(hit, ctx) {
          const s = hit.stats;
          if (!s || !hit.direct || !partners(s.uid).length) return;
          if (id === 'exploit' && family(s) === 'hunter') {
            const primer = fromPartner(marks, hit.enemy, s.uid, hit.now);
            if (primer) { marks.get(hit.enemy.status)!.delete(primer); hit.dmg *= 1.5; ctx.fx.spark(hit.enemy.x, hit.enemy.y - 35, 4, 0xf5bd45); }
          }
          if (id === 'pinpoint' && family(s) === 'hunter' && fromPartner(control, hit.enemy, s.uid, hit.now)) {
            // A conditional crit roll, using the shared seeded combat RNG.
            if (ctx.rng() < 0.35) hit.forceCrit = true;
          }
          if (id === 'compression' && family(s) === 'spreader' && fromPartner(control, hit.enemy, s.uid, hit.now)) {
            const packed = ctx.inRadius(hit.enemy, 90).filter((e) => e !== hit.enemy).length >= 2;
            if (packed) hit.dmg *= 1.35;
          }
        },
        afterHit(hit, ctx) {
          const s = hit.stats;
          if (!s || !hit.direct || !partners(s.uid).length) return;
          if (family(s) === 'controller') stamp(control, hit.enemy, s.uid, hit.now + 1.5);
          if (family(s) === 'primer' && !hit.killed) {
            stamp(marks, hit.enemy, s.uid, hit.now + 3);
            if (id === 'hazard' && fromPartner(control, hit.enemy, s.uid, hit.now)) {
              const st = hit.enemy.status;
              // These values already include affinity and Wet. Do not scale them a second time.
              if (st.poisonUntil > hit.now) st.poisonUntil = Math.max(st.poisonUntil, hit.now + Math.min(8, st.poisonUntil - hit.now + 1));
              if (st.wetUntil > hit.now) st.wetUntil = Math.max(st.wetUntil, hit.now + Math.min(8, st.wetUntil - hit.now + 1));
              if (st.slowUntil > hit.now) applySlow(st, { pct: Math.min(0.65, st.slowPct + 0.1), duration: 1.5 }, hit.now);
            }
          }
          if (id === 'contagion' && family(s) === 'spreader' && fromPartner(marks, hit.enemy, s.uid, hit.now)) {
            // Consumed seed: transferred statuses cannot seed another spread.
            marks.delete(hit.enemy.status);
            const st = hit.enemy.status;
            for (const e of ctx.inRadius(hit.enemy, 90)) {
              if (e === hit.enemy) continue;
              if (st.poisonUntil > hit.now) ctx.poison(e, st.poisonDps * 0.5, (st.poisonUntil - hit.now) * 0.5);
              if (st.burnUntil > hit.now) ctx.ignite(e, { dps: st.burnDps * 0.5, duration: (st.burnUntil - hit.now) * 0.5, tick: st.burnTick });
              if (st.wetUntil > hit.now) ctx.wet(e, (st.wetUntil - hit.now) * 0.5);
              if (st.slowUntil > hit.now) ctx.slow(e, { pct: st.slowPct * 0.5, duration: (st.slowUntil - hit.now) * 0.5 });
            }
            ctx.fx.ring('fx_pulse', hit.enemy.x, hit.enemy.y, 180, 250, 0x8fcb57);
          }
        },
        onTick(_dt, ctx) {
          // Vacuum's suction controls before its first damage pulse.
          for (const w of ctx.build.weapons) {
            if (w.type !== 'vacuum' || !partners(w.uid).length) continue;
            for (const e of ctx.inRadius(ctx.player, w.range)) stamp(control, e, w.uid, ctx.now() + 0.25);
          }
        },
        'pattern:target'(ev, ctx) {
          if (id !== 'pinpoint' || family(ev.stats) !== 'hunter') return;
          const candidates = ev.candidates.filter((e) => fromPartner(control, e, ev.stats.uid, ctx.now()));
          if (candidates.length) {
            ev.prioritized = true;
            ev.target = candidates.reduce((a, b) =>
              Math.hypot(a.x - ctx.player.x, a.y - ctx.player.y) <= Math.hypot(b.x - ctx.player.x, b.y - ctx.player.y) ? a : b);
          }
        },
        onKill(ev, ctx) {
          const hit = ev.hit, s = hit?.stats;
          if (id !== 'overkill' || !s || !hit?.direct || family(s) !== 'hunter') return;
          const spreader = ctx.build.weapons.filter((w) => partners(s.uid).includes(w.uid))
            .sort((a, b) => b.damage - a.damage || a.uid.localeCompare(b.uid))[0];
          if (!spreader) return;
          ctx.damageArea(ev.enemy, 90, spreader.damage * 0.4, spreader, { chained: true, fromPopper: true, label: 'Overkill' });
          ctx.fx.ring('fx_pulse', ev.enemy.x, ev.enemy.y, 180, 250, 0xf5bd45);
        },
      },
    };
  });
}
