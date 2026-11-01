import { defineItem } from '../../engine/define';
import { Buff, Item, Set, Tag } from '../../engine/ids';

export default defineItem({
  id: Item.fuel, kind: 'module', sets: [Set.tools, Set.heat], shape: '1x2', price: 11, buff: Buff.fuel,
  elements: [Tag.heat], // its burn
  unlock: 'starting',
  tune: { dps: [3, 5, 7], duration: 3, tick: 0.5 }, // burn damage per second per ★ (2.5 base x TIER.mult); duration and tick are flat
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
