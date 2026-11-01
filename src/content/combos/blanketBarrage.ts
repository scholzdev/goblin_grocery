import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Popcorn Maker + Blanket: kernels wrap enemies in a soft blanket, reducing their damage while the debuff lasts.
export default defineCombo({
  id: Combo.blanketBarrage, requires: [Item.popcorn, Item.blanket],
  tune: { pct: 0.2, duration: 1.2 },
  text: {
    en: { name: 'Blanket Barrage', short: 'Kernels weaken enemies', summary: 'Popcorn touching a Blanket: every hit tucks a grocery in.', detail: 'Kernel hits make enemies deal {pct|pct} less damage for {duration|s}.' },
    de: { name: 'Deckenhagel', short: 'Körner schwächen Gegner', summary: 'Popcorn berührt eine Decke: Jeder Treffer wickelt einen Gegner ein.', detail: 'Körnertreffer verringern den Schaden von Gegnern für {duration|s} um {pct|pct}.' },
  },
  hooks: {
    'pattern:shotHit'(ev, ctx, c) {
      if (c.touches(ev.stats.uid) && ev.enemy.alive) ctx.weaken(ev.enemy, c.tune().pct, c.tune().duration);
    },
  },
});
