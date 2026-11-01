import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Mop + Magnet: the puddle leaves a magnetic grime mark that makes the target easier to finish.
export default defineCombo({
  id: Combo.stickyMop,
  requires: [Item.mop, Item.magnet],
  tune: { duration: 3 },
  text: {
    en: {
      name: 'Sticky Mop', short: 'Puddles mark enemies',
      summary: 'Mop touching a Magnet: wet grime makes groceries stand out.',
      detail: 'The first time an enemy enters each puddle, it is marked for {duration|s}.',
    },
    de: {
      name: 'Klebriger Mopp', short: 'Pfützen markieren Gegner',
      summary: 'Wischmopp berührt Magnet: nasser Schmutz markiert die Ware.',
      detail: 'Wenn ein Gegner erstmals eine Pfütze betritt, wird er {duration|s} lang markiert.',
    },
  },
  hooks: {
    'pattern:puddleEnter'(ev, ctx, c) {
      if (!ev.first || !c.touches(ev.stats.uid)) return;
      ctx.mark(ev.enemy, c.tune().duration);
    },
  },
});
