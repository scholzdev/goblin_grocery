import { defineSet } from '../../engine/define';
import { Set } from '../../engine/ids';

// Checkout set: cheaper new offers (L1), interest at the end of an aisle (L2: +1 coin per `interestPer` held, capped). Arrays are L1/L2/L3.
// The interest itself is paid by state/run.ts (`endAisle`), which reads this tune through `contentSetTune('checkout', level)`.
export default defineSet({
  id: Set.checkout,
  tune: { priceMult: [0.92, 0.92, 0.85], interestPer: 10, interestCap: [5, 5, 8] },
  text: {
    en: {
      name: 'Checkout',
      bonus: [
        'Shop prices −{priceMult|pctdown}% (new offers)',
        'Interest +1 coin per {interestPer} held (max {interestCap})',
        'Shop prices −{priceMult|pctdown}%; interest +1 coin per {interestPer} held (max {interestCap})',
      ],
    },
    de: {
      name: 'Kasse',
      bonus: [
        'Shop-Preise −{priceMult|pctdown} % (neue Angebote)',
        'Zinsen +1 Münze pro {interestPer} gehalten (max. {interestCap})',
        'Shop-Preise −{priceMult|pctdown} %; Zinsen +1 Münze pro {interestPer} gehalten (max. {interestCap})',
      ],
    },
  },
  build: {
    phase: 'final', order: 10,
    player(b, c) { b.priceMult = c.tune().priceMult; },
  },
});
