import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Tomato + Fuel Can: the poison is volatile and lights up on impact.
export default defineCombo({
  id: Combo.acidTomato,
  requires: [Item.tomato, Item.fuel],
  tune: { dps: 2, duration: 2, tick: 0.5 },
  text: {
    en: {
      name: 'Acid Tomato', short: 'Tomatoes burn too',
      summary: 'Rotten Tomato touching a Fuel Can: the sauce catches fire.',
      detail: 'Direct tomato hits also burn the target for {dps|ps} over {duration|s}.',
    },
    de: {
      name: 'Säuretomate', short: 'Tomaten brennen zusätzlich',
      summary: 'Faule Tomate berührt Benzinkanister: die Soße fängt Feuer.',
      detail: 'Direkte Tomatentreffer setzen das Ziel zusätzlich für {duration|s} in Brand ({dps|ps}).',
    },
  },
  hooks: {
    'pattern:shotHit'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid) || ev.stats.type !== Item.tomato || !ev.enemy.alive) return;
      ctx.ignite(ev.enemy, c.tune());
    },
  },
});
