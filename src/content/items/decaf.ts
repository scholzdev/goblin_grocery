import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Weaken (docs/item-hooks-refactor.md "Weaken"): direct hits of an adjacent weapon cut the damage the enemy deals to you for a few seconds. Kitchen family: the cup
// that keeps the goblin calm and fed, next to Hot Sauce and Ice Pack. The percentage per ★ is the item's own; the engine caps whatever is applied (`WEAKEN.cap`).
// Nothing is rolled (every eligible hit applies it), so the combat-rng stream does not depend on this item.
export default defineItem({
  id: Item.decaf, kind: 'module', sets: [Set.kitchen], shape: '1x1', price: 9,
  tune: { pct: [0.15, 0.2, 0.25], duration: 3 }, // pct per ★; the duration is flat
  text: {
    en: { name: 'Decaf', blurb: 'No kick, no fight.', rules: 'Direct hits of an adjacent weapon weaken enemies: they deal {pct|pct} less damage to you for {duration|s}. The stronger weakening wins, repeated hits refresh.' },
    de: { name: 'Koffeinfrei', blurb: 'Kein Kick, kein Kampfgeist.', rules: 'Direkte Treffer der angrenzenden Waffe schwächen Gegner: Sie richten {duration|s} lang {pct|pct} weniger Schaden bei dir an. Die stärkere Schwächung gilt, wiederholte Treffer erneuern sie.' },
  },
  rows: [{ label: { en: 'Weaken', de: 'Schwächung' }, key: 'pct', fmt: 'pct' }],
  hooks: {
    // Not DoT, not a quiet area tick, no echo / chain / pop (`hit.direct`), like Can Opener.
    onHit(hit, ctx, c) {
      const { stats } = hit;
      if (!stats || !hit.direct || hit.opts.quiet || !c.touches(stats.uid)) return;
      const t = c.tune();
      ctx.weaken(hit.enemy, t.pct, t.duration);
    },
  },
});
