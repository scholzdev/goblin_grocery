import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.helmet, kind: 'passive', sets: [Set.tools], shape: '2x1', price: 12,
  tune: { armor: [2, 3, 4], minimum: 1 },
  text: {
    en: { name: 'Shopping Cart Helmet', blurb: 'Safety first. Shopping second.', rules: 'Take {armor} less damage from each hit, minimum {minimum}. Does not stack. Flat armor applies after percentage reductions and before shields.' },
    de: { name: 'Einkaufswagenhelm', blurb: 'Sicherheit zuerst. Einkauf danach.', rules: 'Nimm {armor} Schaden weniger pro Treffer, mindestens {minimum}. Stapelt sich nicht. Rüstung wirkt nach prozentualer Reduktion und vor Schilden.' },
  },
  rows: [{ label: { en: 'Armor', de: 'Rüstung' }, key: 'armor' }],
  hooks: { order: 10, onPlayerHit(ev, _ctx, c) { if (ev.dmg > 0) ev.dmg = Math.max(c.tune().minimum, ev.dmg - c.tune().armor); } },
});
