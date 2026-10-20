import { defineSet } from '../../engine/define';
import { Set } from '../../engine/ids';

// Checkout set: cheaper new offers (L1), a higher interest cap (L2, L3). Arrays are L1/L2/L3; an `interestCap` of 0 keeps the base cap.
// Interest itself is paid by state/run.ts (`finishWave`): the base rule lives in ECONOMY (data/waves.ts), this tune only raises the cap.
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
