import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.lunchbox, kind: 'passive', sets: [Set.snacks], shape: '2x1', price: 9,
  unlock: 'starting',
  // max HP per ★ (15 base x TIER.mult). ★2 is 22.5: it is rounded in the hook (to 23) and in the text and row.
  tune: { hp: [15, 22.5, 30] },
  text: {
    en: { name: 'Lunchbox', blurb: 'A packed lunch. {hp|+int} max HP.', rules: '{hp|+int} maximum HP while equipped (does not stack, does not heal). Combo: TV Dinner with Microwave + Battery.' },
    de: { name: 'Brotdose', blurb: 'Ein Pausenbrot. {hp|+int} max. LP.', rules: '{hp|+int} maximale LP, solange ausgerüstet (stapelt sich nicht, heilt nicht). Combo: Fertiggericht mit Mikrowelle + Batterie.' },
  },
  rows: [{ label: { en: 'Max HP', de: 'Max. LP' }, key: 'hp', fmt: '+int' }],
  build: {
    // Adds the rounded bonus only. The total max HP is rounded once, after Expired Milk's x0.9 (computeBuild), never here.
    phase: 'final',
    player(b, c) { b.maxHp += Math.round(c.tune().hp); },
  },
});
