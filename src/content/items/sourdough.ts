import { cells, defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// +6% weapon damage per effective star, per touching starter (linear through zero, not through ★1 like the [a, 1.5a, 2a] tunes:
// Sourdough's ★2 is exactly twice its ★1). `perStar` drives the hook, `damage` is the same number per ★ for the text and the shop row.
const PER_STAR = 0.06;
// The footprint grows with the tier: 1 cell, 2 cells, then an L of 3.
const SHAPES = [cells('#'), cells('##'), cells('##', '#.')] as const;

export default defineItem({
  id: Item.sourdough, kind: 'passive', sets: [Set.kitchen], shape: (tier) => SHAPES[Math.min(Math.max(tier, 1), 3) - 1], price: 6,
  age: 'owned',
  // `every` = aisles between rises (read by state/run.ts). cellsMid/cellsMax = footprint sizes at ★2/★3, for the text.
  tune: { perStar: PER_STAR, damage: [PER_STAR * 1, PER_STAR * 2, PER_STAR * 3], every: 2, cellsMid: SHAPES[1].length, cellsMax: SHAPES[2].length },
  text: {
    en: { name: 'Sourdough Starter', blurb: 'Feed it and it grows. Bubbles with potential.', rules: 'Weapons touching it gain {damage|+pct} damage. Grows one level every {every|int} aisles (needs room to rise): {cellsMid|int} cells at ★2, {cellsMax|int} cells at ★3. Combo: Fresh Bread with Toaster.' },
    de: { name: 'Sauerteig-Ansatz', blurb: 'Füttern, und er wächst. Blubbert vor Potenzial.', rules: 'Angrenzende Waffen erhalten {damage|+pct} Schaden. Wächst alle {every|int} Gänge um eine Stufe (braucht Platz zum Aufgehen): {cellsMid|int} Felder bei ★2, {cellsMax|int} Felder bei ★3. Combo: Frisches Brot mit Toaster.' },
  },
  rows: [{ label: { en: 'Damage', de: 'Schaden' }, key: 'damage', fmt: '+pct' }],
  build: {
    // Per instance, with its own effective tier (Gold Star included): `c.tier` would be the best copy in the cart.
    // global-mod: after Jelly Beans, before Power Strip (order) and before the set bonuses and Bundle Deal.
    phase: 'global-mod', order: 10,
    weapon(w, c) {
      const { perStar } = c.tune();
      for (const n of c.touching(w)) w.damage *= 1 + perStar * n.tier;
    },
  },
});
