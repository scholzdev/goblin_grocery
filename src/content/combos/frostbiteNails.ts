import { defineCombo } from '../../engine/define';
import { Combo, Item, Tag } from '../../engine/ids';

// Nail Gun + Ice Pack: nails pierce one more enemy, and every `every`th nail that hits the same enemy freezes it. The count is
// `enemy.nailHits` (shared by every nail gun, as before); the ordinal suffix in the text ("3rd") is literal.
export default defineCombo({
  id: Combo.frostbiteNails, requires: [Item.nailgun, Item.ice],
  tune: { every: 3, freeze: 0.7, extraPierce: 1 },
  text: {
    en: {
      name: 'Frostbite Nails', short: '{every}rd hit freezes',
      summary: 'Nail Gun touching an Ice Pack: nails freeze groceries solid.',
      detail: 'Nails pierce {extraPierce} extra enemy, and every {every}rd nail that hits the same enemy freezes it solid for {freeze|s}.',
    },
    de: {
      name: 'Frostbeulen-Nägel', short: '{every}. Treffer friert ein',
      summary: 'Nagelpistole berührt Kühlakku: Nägel frieren Gegner steif.',
      detail: 'Nägel durchschlagen {extraPierce} weiteren Gegner, und jeder {every}. Nagel, der denselben Gegner trifft, friert ihn {freeze|s} lang fest.',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) { w.pierce += c.tune().extraPierce; },
  },
  hooks: {
    'pattern:shotHit'(ev, ctx, c) {
      const e = ev.enemy;
      if (!c.touches(ev.stats.uid) || ev.stats.pattern !== 'burst' || !e.alive) return;
      const t = c.tune();
      e.nailHits = (e.nailHits ?? 0) + 1;
      if (e.nailHits % t.every === 0) { ctx.stun(e, t.freeze, Tag.frost); ctx.fx.frostBurst(e.x, e.y - 20, 6); }
    },
  },
});
