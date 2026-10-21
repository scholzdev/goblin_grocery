import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.ovenmitts, kind: 'passive', sets: [Set.kitchen], shape: '1x2', price: 10,
  tune: { reduction: [0.2, 0.25, 0.3], range: 120 },
  text: {
    en: { name: 'Oven Mitts', blurb: 'Handle angry groceries with care.', rules: 'Take {reduction|pct} less damage from enemies attacking within {range} of the cart. Does not stack.' },
    de: { name: 'Ofenhandschuhe', blurb: 'Wütende Lebensmittel vorsichtig anfassen.', rules: 'Nimm {reduction|pct} weniger Schaden von Gegnern, die im Umkreis von {range} um den Wagen angreifen. Stapelt sich nicht.' },
  },
  rows: [{ label: { en: 'Close damage reduction', de: 'Nahschadensreduktion' }, key: 'reduction', fmt: 'pct' }],
  hooks: {
    order: -40,
    onPlayerHit(ev, ctx, c) {
      const src = ev.source;
      if (!src || src.how === 'hazard' || src.how === 'event' || src.how === 'self') return;
      const close = src.origin ? ctx.playerNear(src.origin.x, src.origin.y).d <= c.tune().range : ['contact', 'charge', 'swipe'].includes(src.how);
      if (close) ev.dmg *= 1 - c.tune().reduction;
    },
  },
});
