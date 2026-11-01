import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Tomato + Hot Sauce: every direct tomato hit leaves a Sale Flag-style mark.
export default defineCombo({
  id: Combo.bloodyMary,
  requires: [Item.tomato, Item.hotsauce],
  tune: { duration: 3 },
  text: {
    en: {
      name: 'Bloody Mary', short: 'Tomatoes mark targets',
      summary: 'Rotten Tomato touching Hot Sauce: every hit puts a hot sticker on the grocery.',
      detail: 'Direct tomato hits mark enemies for {duration|s}, increasing damage from all sources.',
    },
    de: {
      name: 'Bloody Mary', short: 'Tomaten markieren Ziele',
      summary: 'Faule Tomate berührt Scharfe Soße: jeder Treffer klebt einen heißen Aufkleber auf die Ware.',
      detail: 'Direkte Tomatentreffer markieren Gegner {duration|s} lang und erhöhen den Schaden aus allen Quellen.',
    },
  },
  hooks: {
    'pattern:shotHit'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid) || ev.stats.type !== Item.tomato || !ev.enemy.alive) return;
      ctx.mark(ev.enemy, c.tune().duration);
    },
  },
});
