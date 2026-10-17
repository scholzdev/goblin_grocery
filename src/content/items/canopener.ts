import { defineItem, SHRED } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Shred (docs/item-hooks-refactor.md "Shred"): direct hits of an adjacent weapon sometimes leave a stack. The stack numbers are the engine's
// (`SHRED`), listed here so the text reads them. The roll is one combat-rng draw per eligible hit (also at 100%, so the stream never depends on the tier).
export default defineItem({
  id: Item.canopener, kind: 'module', sets: [Set.tools], shape: '1x2', price: 9,
  shreds: true, // "Strong vs: Armored" on the shop card
  tune: { chance: [0.5, 0.75, 1], stacks: 1, duration: SHRED.duration, cap: SHRED.cap }, // chance per ★; the rest is flat
  text: {
    en: { name: 'Can Opener', blurb: 'Armor is just a lid.', rules: 'Direct hits of an adjacent weapon have a {chance|pct} chance to Shred: each stack strips a point of armor for {duration|s}, up to {cap} stacks. With no armor left, Shred adds a little damage.' },
    de: { name: 'Dosenöffner', blurb: 'Panzerung ist nur ein Deckel.', rules: 'Direkte Treffer der angrenzenden Waffe reißen mit {chance|pct} Chance auf: Jeder Stapel nimmt {duration|s} lang einen Punkt Panzerung, bis zu {cap} Stapel. Ohne Panzerung macht Aufreißen etwas Zusatzschaden.' },
  },
  rows: [{ label: { en: 'Shred chance', de: 'Aufreiß-Chance' }, key: 'chance', fmt: 'pct' }],
  hooks: {
    // After the armor step, so the hit that opens an enemy is still soaked by it. Not DoT, not a quiet area tick, no echo / chain / pop.
    onHit(hit, ctx, c) {
      const { stats } = hit;
      if (!stats || !hit.direct || hit.opts.quiet || !c.touches(stats.uid)) return;
      const t = c.tune();
      if (ctx.rng() < t.chance) ctx.shred(hit.enemy, t.stacks, t.duration);
    },
  },
});
