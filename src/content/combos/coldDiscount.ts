import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Snow Cone Machine + Coupon Book: a bargain slush machine reaches farther down the aisle.
export default defineCombo({
  id: Combo.coldDiscount, requires: [Item.snowcone, Item.coupon],
  tune: { rangeMult: 1.3 },
  text: {
    en: {
      name: 'Cold Discount', short: 'Longer puddles',
      summary: 'Snow Cone Machine touching a Coupon Book: cold deals cover more floor.',
      detail: 'Puddles gain {rangeMult|x} range.',
    },
    de: {
      name: 'Kälterabatt', short: 'Größere Pfützen',
      summary: 'Slush-Maschine berührt Couponheft: kalte Angebote bedecken mehr Boden.',
      detail: 'Pfützen erhalten {rangeMult|x} Reichweite.',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) { w.range *= c.tune().rangeMult; },
  },
});
