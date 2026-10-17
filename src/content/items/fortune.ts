import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'fortune', kind: 'passive', sets: ['snacks'], shape: '1x1', price: 8,
  unlock: 'starting',
  tune: { crit: [0.05, 0.075, 0.1] }, // crit chance added to every weapon per ★ (5% base x TIER.mult)
  text: {
    en: { name: 'Fortune Cookie', blurb: 'Your lucky numbers: 2, 2, 2.', rules: 'Every weapon gains {crit|+pct1} chance to crit for double damage (adds to the Price Gun, does not stack).' },
    de: { name: 'Glückskeks', blurb: 'Deine Glückszahlen: 2, 2, 2.', rules: 'Jede Waffe erhält {crit|+pct1} Chance auf einen Krit für doppelten Schaden (addiert sich zum Preisauszeichner, stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Crit chance', de: 'Kritchance' }, key: 'crit', fmt: '+pct1' }],
  build: {
    // Cart-wide, so no touching check. Adds (+=) to the crit chance Price Gun assigned in the module phase (nothing between the
    // two phases reads critChance).
    phase: 'post-combo',
    weapon(w, c) { w.critChance += c.tune().crit; },
  },
});
