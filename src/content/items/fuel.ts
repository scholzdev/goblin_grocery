import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'fuel', kind: 'module', sets: ['tools', 'heat'], shape: '1x2', price: 11, buff: 'fuel',
  elements: ['heat'], // its burn
  unlock: 'starting',
  tune: { dps: [2.5, 3.75, 5], duration: 2, tick: 0.5 }, // burn damage per second per ★ (2.5 base x TIER.mult); duration and tick are flat
  text: {
    en: { name: 'Fuel Can', blurb: 'Questionable. Sets every hit on fire.', rules: 'Any adjacent weapon sets enemies on fire: {dps|ps} burn damage for {duration|s} (refreshes, never stacks).' },
    de: { name: 'Benzinkanister', blurb: 'Fragwürdig. Setzt jeden Treffer in Brand.', rules: 'Jede angrenzende Waffe setzt Gegner in Brand: {dps|ps} Brandschaden für {duration|s} (erneuert sich, stapelt sich nie).' },
  },
  rows: [{ label: { en: 'Burn', de: 'Brand' }, key: 'dps', fmt: 'ps' }],
  build: {
    phase: 'module', order: 20,
    weapon(w, c) {
      const t = c.tune();
      w.burn = { dps: t.dps, duration: t.duration, tick: t.tick };
    },
  },
});
