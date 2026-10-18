import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Legendary (★1 only). Shop prices -25%: it multiplies `priceMult`, so it stacks with the Checkout set (which assigns it at order 10).
export default defineItem({
  id: Item.expiredcoupon, kind: 'passive', sets: [Set.checkout], shape: '1x1', price: 28, legendary: true,
  tune: { priceMult: 0.75 },
  text: {
    en: { name: 'Expired Coupon', blurb: 'Long expired. Nobody checks.', rules: 'Shop prices −{priceMult|pctdown}% (new offers). Stacks with the Checkout set.' },
    de: { name: 'Abgelaufener Gutschein', blurb: 'Längst abgelaufen. Niemand prüft nach.', rules: 'Shop-Preise −{priceMult|pctdown} % (neue Angebote). Stapelt sich mit dem Kassen-Set.' },
  },
  build: {
    phase: 'final', order: 20,
    player(b, c) { b.priceMult *= c.tune().priceMult; },
  },
});
