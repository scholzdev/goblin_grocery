import { defineSet } from '../../engine/define';
import { Set } from '../../engine/ids';

// An `interestCap` of 0 keeps the base cap (`ECONOMY.interestCap`).
export default defineSet({
  id: Set.checkout,
  tune: { priceMult: [0.92, 0.92, 0.85], interestCap: [0, 6, 10] },
  text: {
    en: {
      name: 'Checkout',
      bonus: [
        'Shop prices −{priceMult|pctdown}% (new offers)',
        'Interest cap raised to {interestCap}',
        'Shop prices −{priceMult|pctdown}%; interest cap raised to {interestCap}',
      ],
    },
    de: {
      name: 'Kasse',
      bonus: [
        'Shop-Preise −{priceMult|pctdown} % (neue Angebote)',
        'Zinsobergrenze steigt auf {interestCap}',
        'Shop-Preise −{priceMult|pctdown} %; Zinsobergrenze steigt auf {interestCap}',
      ],
    },
  },
  build: {
    phase: 'final', order: 10,
    player(b, c) { b.priceMult = c.tune().priceMult; },
  },
});
