import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'lunchbox', kind: 'passive', sets: ['snacks'], shape: '2x1', price: 9,
  unlock: 'starting',
  // max HP per ★ (the legacy 15 base x TIER.mult). ★2 is 22.5: it is rounded in the hook (to 23) and in the text and row, like the legacy.
  tune: { hp: [15, 22.5, 30] },
  text: {
    en: { name: 'Lunchbox', blurb: 'A packed lunch. +15 max HP.', rules: '{hp|+int} maximum HP while equipped (does not stack, does not heal). Combo: TV Dinner with Microwave + Battery.' },
    de: { name: 'Brotdose', blurb: 'Ein Pausenbrot. +15 max. LP.', rules: '{hp|+int} maximale LP, solange ausgerüstet (stapelt sich nicht, heilt nicht). Combo: Fertiggericht mit Mikrowelle + Batterie.' },
  },
  rows: [{ label: { en: 'Max HP', de: 'Max. LP' }, key: 'hp', fmt: '+int' }],
  build: {
    // Adds the rounded bonus only. The total max HP is rounded once, after Expired Milk's x0.9 (computeBuild), never here.
    phase: 'final',
    player(b, c) { b.maxHp += Math.round(c.tune().hp); },
  },
});
