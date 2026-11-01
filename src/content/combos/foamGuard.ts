import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Mop + Bubble Wrap: the foam clings to groceries and makes their attacks weaker.
export default defineCombo({
  id: Combo.foamGuard,
  requires: [Item.mop, Item.bubblewrap],
  tune: { pct: 0.25, duration: 2.5 },
  text: {
    en: {
      name: 'Foam Guard', short: 'Puddles weaken enemies',
      summary: 'Mop touching Bubble Wrap: sticky foam dulls grocery attacks.',
      detail: 'The first time an enemy enters each puddle, it deals {pct|pctdown}% less damage for {duration|s}.',
    },
    de: {
      name: 'Schaumwache', short: 'Pfützen schwächen Gegner',
      summary: 'Wischmopp berührt Luftpolsterfolie: klebriger Schaum schwächt die Angriffe.',
      detail: 'Wenn ein Gegner erstmals eine Pfütze betritt, verursacht er {duration|s} lang {pct|pctdown}% weniger Schaden.',
    },
  },
  hooks: {
    'pattern:puddleEnter'(ev, ctx, c) {
      if (!ev.first || !c.touches(ev.stats.uid)) return;
      const t = c.tune();
      ctx.weaken(ev.enemy, t.pct, t.duration);
    },
  },
});
