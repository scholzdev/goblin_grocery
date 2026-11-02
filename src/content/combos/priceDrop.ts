import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Self-Checkout Laser + Coupon Book: a kill by the laser gets one more coin roll at `chanceMult` x the Coupon Book's chance (its own tier, capped at its `cap`),
// on top of the Coupon Book's regular roll. The laser is identified by the killing hit's weapon uid.
export default defineCombo({
  id: Combo.priceDrop, requires: [Item.laser, Item.coupon],
  tune: { chanceMult: 2 },
  text: {
    en: {
      name: 'Price Drop', short: 'Laser kills drop extra coins',
      summary: 'Self-Checkout Laser touching a Coupon Book: scanned goods are half price, coins double.',
      detail: 'Kills by the laser roll again for an extra coin at {chanceMult|x} the Coupon Book chance (capped at the Coupon Book cap).',
    },
    de: {
      name: 'Preissturz', short: 'Laser-Abschüsse lassen Extra-Münzen fallen',
      summary: 'Selbstscan-Laser berührt Couponheft: gescannte Ware kostet die Hälfte, Münzen das Doppelte.',
      detail: 'Abschüsse durch den Laser würfeln erneut auf eine Extra-Münze mit {chanceMult|x} der Couponheft-Chance (begrenzt durch die Couponheft-Obergrenze).',
    },
  },
  hooks: {
    onKill(ev, ctx, c) {
      if (!c.touches(ev.hit?.stats?.uid ?? '')) return;
      const k = c.tuneOf(Item.coupon, c.owned(Item.coupon));
      if (ctx.rng() < Math.min(k.cap, k.chance * c.tune().chanceMult)) ctx.dropCoin(ev.enemy, ctx.t('coinCoupon'));
    },
  },
});
