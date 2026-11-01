import { AFFINITY, defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

const W = weaponBase({ pattern: 'tomato', damage: 2, cooldown: 1.0, range: 400, projectileSpeed: 430 });
// Only a direct tomato hit arms a spread. Transferred poison can never propagate again.
interface Rot { dps: number; until: number; spread: boolean }

export default defineItem({
  id: Item.tomato, kind: 'weapon', sets: [Set.snacks], shape: '1x2', price: 13, tags: ['ranged'],
  weapon: W,
  tune: { ...weaponTiers(W), range: W.range, dps: [5, 10, 15], duration: 6, spreadRadius: 75 },
  rows: [...WEAPON_ROWS, { label: { en: 'Poison', de: 'Gift' }, key: 'dps', fmt: 'ps' }],
  text: {
    en: { name: 'Rotten Tomato', blurb: 'Past its best. Coming for yours.', rules: 'Throws a tomato every {cooldown|s} ({range} range): {damage} impact damage and {dps|ps} poison for {duration|s}. Prefers unpoisoned groceries. Poison refreshes, never stacks.', star3: '★3: When a poisoned grocery dies, its remaining tomato poison spreads within {spreadRadius}. Spread poison cannot spread again.' },
    de: { name: 'Faule Tomate', blurb: 'Ihre besten Tage sind vorbei. Deine bald auch.', rules: 'Wirft alle {cooldown|s} eine Tomate ({range} Reichweite): {damage} Trefferschaden und {dps|ps} Gift für {duration|s}. Bevorzugt unvergiftete Gegner. Gift erneuert sich, stapelt sich nie.', star3: '★3: Stirbt ein vergifteter Gegner, breitet sich sein verbleibendes Tomatengift im Umkreis von {spreadRadius} aus. Verbreitetes Gift breitet sich nicht erneut aus.' },
  },
  hooks: {
    onHit(hit, ctx, c) {
      const st = hit.stats;
      if (st?.type !== Item.tomato || !hit.direct || hit.opts.quiet) return;
      const t = c.tuneOf(Item.tomato, st.tier);
      // Follow the firing instance's tier and damage bonuses, even in a mixed-tier cart.
      const dps = t.dps * st.damage / t.damage;
      const rots: Map<number, Rot> = c.state.rots ??= new Map<number, Rot>();
      const previous = rots.get(hit.enemy.id);
      const active = previous && previous.until > ctx.now() && hit.enemy.status.poisonUntil > ctx.now();
      const durationMult = hit.enemy.def.weak?.poison ? AFFINITY.weakDuration : hit.enemy.def.resist?.poison ? AFFINITY.resistDuration : 1;
      ctx.poison(hit.enemy, dps, t.duration);
      rots.set(hit.enemy.id, {
        dps: active ? Math.max(previous.dps, dps) : dps,
        until: Math.max(active ? previous.until : 0, ctx.now() + t.duration * durationMult),
        spread: st.tier >= 3 || !!(active && previous.spread),
      });
      ctx.fx.spark(hit.enemy.x, hit.enemy.y - 20, 4, 0x8fcb57);
    },
    onKill(ev, ctx, c) {
      const rots: Map<number, Rot> | undefined = c.state.rots;
      const rot = rots?.get(ev.enemy.id);
      rots?.delete(ev.enemy.id);
      const remaining = rot ? Math.min(rot.until, ev.enemy.status.poisonUntil) - ctx.now() : 0;
      if (!rot?.spread || remaining <= 0) return;
      const radius = c.tune().spreadRadius;
      for (const e of ctx.inRadius(ev.enemy, radius)) {
        ctx.poison(e, rot.dps, remaining);
        // Do not erase a living target's own direct-hit spread eligibility.
        if (!rots!.get(e.id)?.spread) rots!.set(e.id, { dps: rot.dps, until: e.status.poisonUntil, spread: false });
      }
      ctx.fx.ring('fx_pulse', ev.enemy.x, ev.enemy.y, radius * 2, 300, 0x8fcb57);
    },
    onTick(_dt, ctx, c) {
      const rots: Map<number, Rot> | undefined = c.state.rots;
      if (rots) for (const [id, rot] of rots) if (rot.until <= ctx.now()) rots.delete(id);
    },
  },
});
