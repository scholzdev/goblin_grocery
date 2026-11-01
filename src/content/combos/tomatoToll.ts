import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Tomato + Shopping Bell: tomato kills call every loose coin home.
export default defineCombo({
  id: Combo.tomatoToll,
  requires: [Item.tomato, Item.bell],
  tune: { pullRadius: 1 },
  text: {
    en: {
      name: 'Tomato Toll', short: 'Tomato kills pull coins',
      summary: 'Rotten Tomato touching a Shopping Bell: every rotten grocery rings the till.',
      detail: 'When a tomato hit kills an enemy, all loose coins fly to the cart.',
    },
    de: {
      name: 'Tomatenzoll', short: 'Tomaten-Kills ziehen Münzen an',
      summary: 'Faule Tomate berührt Einkaufsklingel: jede faule Ware klingelt an der Kasse.',
      detail: 'Wenn ein Tomatentreffer einen Gegner tötet, fliegen alle Münzen zum Wagen.',
    },
  },
  hooks: {
    onKill(ev, ctx, c) {
      if (!c.touches(ev.hit?.stats?.uid ?? '') || ev.hit?.stats?.type !== Item.tomato) return;
      ctx.pullCoins();
    },
  },
});
