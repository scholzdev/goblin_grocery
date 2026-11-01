import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Mop + Hot Sauce: the first time each enemy enters a soap puddle, the hot water ignites it.
export default defineCombo({
  id: Combo.scaldingClean,
  requires: [Item.mop, Item.hotsauce],
  tune: { dps: 3, duration: 2, tick: 0.5 },
  text: {
    en: {
      name: 'Scalding Clean', short: 'Puddles ignite enemies',
      summary: 'Mop touching Hot Sauce: the clean is painfully hot.',
      detail: 'The first time an enemy enters each puddle, it burns for {dps} damage/s for {duration|s}.',
    },
    de: {
      name: 'Heißes Wischen', short: 'Pfützen entzünden Gegner',
      summary: 'Wischmopp berührt Scharfe Soße: der Boden ist kochend heiß.',
      detail: 'Wenn ein Gegner erstmals eine Pfütze betritt, brennt er {duration|s} lang für {dps} Schaden/s.',
    },
  },
  hooks: {
    'pattern:puddleEnter'(ev, ctx, c) {
      if (!ev.first || !c.touches(ev.stats.uid)) return;
      ctx.ignite(ev.enemy, c.tune());
      ctx.fx.flame(ev.enemy.x, ev.enemy.y - 20);
    },
  },
});
